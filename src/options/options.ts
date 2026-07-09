import { BUILTIN_PROMPTS, DEFAULT_SYSTEM_PROMPT, mergePrompts, NEW_PROMPT_TEMPLATE } from '../prompts'
import { getPromptState, savePromptState, type PromptState } from '../storage'
import type { PromptDefinition } from '../types'
import { confirmDialog, unsavedChangesDialog } from '../ui/confirm-dialog'
import { sparklesIcon } from '../ui/sparkles'
import { showToast } from '../ui/toast'
import { duplicateName, insertAtCursor, isDirty, templateWarning, type EditorFields } from './editor-logic'

let state: PromptState = { overrides: {}, customs: [], systemPrompt: null }
let selectedId: string | null = null
let activeId = 'default'
/** Snapshot of the fields as last opened/saved; null while no prompt is open. */
let savedFields: EditorFields | null = null

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T
}

function pristineBuiltin(id: string): PromptDefinition | undefined {
  return BUILTIN_PROMPTS.find((p) => p.id === id)
}

function allPrompts(): PromptDefinition[] {
  return mergePrompts(state.overrides, state.customs)
}

function selectedPrompt(): PromptDefinition | undefined {
  return allPrompts().find((p) => p.id === selectedId)
}

// ---- Dirty tracking ----

function currentFields(): EditorFields {
  return {
    name: el<HTMLInputElement>('prompt-name').value,
    template: el<HTMLTextAreaElement>('prompt-template').value,
  }
}

function editorIsDirty(): boolean {
  return savedFields !== null && isDirty(savedFields, currentFields())
}

function refreshDirtyBadge(): void {
  el('unsaved-badge').hidden = !editorIsDirty()
}

function refreshTemplateWarning(): void {
  const warning = templateWarning(el<HTMLTextAreaElement>('prompt-template').value)
  const warningEl = el('template-warning')
  warningEl.textContent = warning ?? ''
  warningEl.hidden = warning === null
}

/**
 * Gate for anything that would drop unsaved edits (switching, duplicating,
 * creating). Resolves true when it's safe to proceed.
 */
async function guardDirty(): Promise<boolean> {
  if (!editorIsDirty()) return true
  const choice = await unsavedChangesDialog()
  if (choice === 'cancel') return false
  if (choice === 'save') return savePrompt()
  return true // discard
}

// ---- Prompt list ----

function renderList(): void {
  const list = el('prompt-list')
  list.replaceChildren()

  for (const prompt of allPrompts()) {
    const li = document.createElement('li')
    if (prompt.id === selectedId) li.classList.add('selected')
    if (prompt.id === activeId) li.classList.add('active')

    const button = document.createElement('button')
    button.type = 'button'

    const dot = document.createElement('span')
    dot.className = 'row-dot'
    if (prompt.id === activeId) dot.title = 'Active prompt'
    button.appendChild(dot)

    const name = document.createElement('span')
    name.className = 'row-name'
    name.textContent = prompt.name
    button.appendChild(name)

    if (prompt.builtin) {
      const badge = document.createElement('span')
      const edited = prompt.id in state.overrides
      badge.className = edited ? 'mcs-badge mcs-badge-edited' : 'mcs-badge'
      badge.textContent = edited ? 'edited' : 'built-in'
      button.appendChild(badge)
    }

    button.addEventListener('click', () => void selectPrompt(prompt.id))

    li.appendChild(button)
    list.appendChild(li)
  }
}

// ---- Editor ----

async function selectPrompt(id: string): Promise<void> {
  if (id === selectedId) return
  if (!(await guardDirty())) return
  selectedId = id
  const prompt = selectedPrompt()
  if (prompt) openEditor(prompt)
  renderList()
}

function openEditor(prompt: PromptDefinition): void {
  el('editor-empty').hidden = true
  el('editor-form').hidden = false

  el<HTMLInputElement>('prompt-name').value = prompt.name
  el<HTMLTextAreaElement>('prompt-template').value = prompt.template
  savedFields = { name: prompt.name, template: prompt.template }

  refreshEditorHead(prompt)
  refreshDirtyBadge()
  refreshTemplateWarning()
}

function refreshEditorHead(prompt: PromptDefinition): void {
  el('editor-title').textContent = prompt.name

  const badge = el('editor-badge')
  if (prompt.builtin) {
    const edited = prompt.id in state.overrides
    badge.className = edited ? 'mcs-badge mcs-badge-edited' : 'mcs-badge'
    badge.textContent = edited ? 'built-in · edited' : 'built-in'
    badge.hidden = false
  } else {
    badge.hidden = true
  }

  const isActive = prompt.id === activeId
  el('active-indicator').hidden = !isActive
  el('make-active').hidden = isActive
  el('delete-prompt').hidden = prompt.builtin
  el('reset-prompt').hidden = !(prompt.builtin && prompt.id in state.overrides)
}

/** Returns true when the prompt was actually saved. */
async function savePrompt(): Promise<boolean> {
  if (!selectedId) return false
  const name = el<HTMLInputElement>('prompt-name').value.trim()
  const template = el<HTMLTextAreaElement>('prompt-template').value

  if (!name || !template.trim()) {
    showToast('Name and template are required.', 'error')
    return false
  }

  const pristine = pristineBuiltin(selectedId)
  if (pristine) {
    if (pristine.name === name && pristine.template === template) {
      // Edit matches the default — no override needed
      delete state.overrides[selectedId]
    } else {
      state.overrides[selectedId] = { name, template }
    }
  } else {
    const custom = state.customs.find((c) => c.id === selectedId)
    if (!custom) return false
    custom.name = name
    custom.template = template
  }

  await savePromptState(state)
  savedFields = { name, template }
  renderList()
  const prompt = selectedPrompt()
  if (prompt) refreshEditorHead(prompt)
  refreshDirtyBadge()
  showToast('Saved.')
  return true
}

async function createPrompt(): Promise<void> {
  if (!(await guardDirty())) return
  const prompt: PromptDefinition = {
    id: crypto.randomUUID(),
    name: 'New prompt',
    builtin: false,
    template: NEW_PROMPT_TEMPLATE,
  }
  state.customs.push(prompt)
  await savePromptState(state)
  selectedId = prompt.id
  renderList()
  openEditor(prompt)
  el<HTMLInputElement>('prompt-name').focus()
  el<HTMLInputElement>('prompt-name').select()
}

async function duplicatePrompt(): Promise<void> {
  const source = selectedPrompt()
  if (!source) return
  if (!(await guardDirty())) return

  const copy: PromptDefinition = {
    id: crypto.randomUUID(),
    name: duplicateName(source.name, allPrompts().map((p) => p.name)),
    builtin: false,
    template: source.template,
  }
  state.customs.push(copy)
  await savePromptState(state)
  selectedId = copy.id
  renderList()
  openEditor(copy)
  showToast('Duplicated.')
}

async function resetPrompt(): Promise<void> {
  if (!selectedId || !(selectedId in state.overrides)) return
  delete state.overrides[selectedId]
  await savePromptState(state)
  renderList()
  openEditor(pristineBuiltin(selectedId)!)
  showToast('Reset to default.')
}

async function deletePrompt(): Promise<void> {
  if (!selectedId) return
  const custom = state.customs.find((c) => c.id === selectedId)
  if (!custom) return // built-ins cannot be deleted

  const confirmed = await confirmDialog({
    title: 'Delete prompt',
    message: `Delete "${custom.name}"? This cannot be undone.`,
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!confirmed) return

  state.customs = state.customs.filter((c) => c.id !== selectedId)
  await savePromptState(state)

  // If the deleted prompt was in use, fall back to the default one
  if (activeId === selectedId) {
    await chrome.storage.sync.set({ selectedPromptId: 'default' })
    activeId = 'default'
  }

  selectedId = null
  savedFields = null
  el('editor-form').hidden = true
  el('editor-empty').hidden = false
  renderList()
  showToast('Deleted.')
}

async function makeActive(): Promise<void> {
  if (!selectedId) return
  await chrome.storage.sync.set({ selectedPromptId: selectedId })
  activeId = selectedId
  renderList()
  const prompt = selectedPrompt()
  if (prompt) refreshEditorHead(prompt)
  showToast('Now used for summaries.')
}

// ---- System prompt ----

function renderSystemPrompt(): void {
  el<HTMLTextAreaElement>('system-prompt').value = state.systemPrompt ?? DEFAULT_SYSTEM_PROMPT
}

async function saveSystemPrompt(): Promise<void> {
  const text = el<HTMLTextAreaElement>('system-prompt').value.trim()
  state.systemPrompt = text && text !== DEFAULT_SYSTEM_PROMPT ? text : null
  await savePromptState(state)
  renderSystemPrompt()
  showToast('Saved.')
}

async function resetSystemPrompt(): Promise<void> {
  state.systemPrompt = null
  await savePromptState(state)
  renderSystemPrompt()
  showToast('Reset to default.')
}

// ---- Init ----

document.addEventListener('DOMContentLoaded', () => {
  // Static SVGs from our own icon factory — no user content involved.
  el('title-icon').innerHTML = sparklesIcon(22, 'mcs-grad-page')
  el('empty-icon').innerHTML = sparklesIcon(36, 'mcs-grad-empty')

  void (async () => {
    const [promptState, { selectedPromptId }] = await Promise.all([
      getPromptState(),
      chrome.storage.sync.get({ selectedPromptId: 'default' }) as Promise<{
        selectedPromptId: string
      }>,
    ])
    state = promptState
    activeId = selectedPromptId
    renderList()
    renderSystemPrompt()
  })()

  el('new-prompt').addEventListener('click', () => void createPrompt())
  el('save-prompt').addEventListener('click', () => void savePrompt())
  el('reset-prompt').addEventListener('click', () => void resetPrompt())
  el('delete-prompt').addEventListener('click', () => void deletePrompt())
  el('duplicate-prompt').addEventListener('click', () => void duplicatePrompt())
  el('make-active').addEventListener('click', () => void makeActive())
  el('save-system').addEventListener('click', () => void saveSystemPrompt())
  el('reset-system').addEventListener('click', () => void resetSystemPrompt())

  el('prompt-name').addEventListener('input', refreshDirtyBadge)
  el('prompt-template').addEventListener('input', () => {
    refreshDirtyBadge()
    refreshTemplateWarning()
  })

  const template = el<HTMLTextAreaElement>('prompt-template')
  for (const chip of document.querySelectorAll<HTMLButtonElement>('.mcs-chip[data-placeholder]')) {
    chip.addEventListener('click', () => insertAtCursor(template, chip.dataset.placeholder!))
  }

  // The active prompt can also change from the on-site dropdown while this
  // tab is open — keep the gradient dot in sync.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !('selectedPromptId' in changes)) return
    activeId = (changes.selectedPromptId.newValue as string | undefined) ?? 'default'
    renderList()
    const prompt = selectedPrompt()
    if (prompt) refreshEditorHead(prompt)
  })

  window.addEventListener('beforeunload', (event) => {
    if (editorIsDirty()) event.preventDefault()
  })
})
