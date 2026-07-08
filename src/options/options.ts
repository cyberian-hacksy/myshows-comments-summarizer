import { BUILTIN_PROMPTS, DEFAULT_SYSTEM_PROMPT, mergePrompts, NEW_PROMPT_TEMPLATE } from '../prompts'
import { getPromptState, savePromptState, type PromptState } from '../storage'
import type { PromptDefinition } from '../types'

let state: PromptState = { overrides: {}, customs: [], systemPrompt: null }
let selectedId: string | null = null

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T
}

function pristineBuiltin(id: string): PromptDefinition | undefined {
  return BUILTIN_PROMPTS.find((p) => p.id === id)
}

function allPrompts(): PromptDefinition[] {
  return mergePrompts(state.overrides, state.customs)
}

function flashStatus(target: 'editor-status' | 'system-status', message: string): void {
  const status = el(target)
  status.textContent = message
  setTimeout(() => {
    status.textContent = ''
  }, 2000)
}

// ---- Prompt list ----

function renderList(): void {
  const list = el('prompt-list')
  list.replaceChildren()

  for (const prompt of allPrompts()) {
    const li = document.createElement('li')
    if (prompt.id === selectedId) li.classList.add('selected')

    const button = document.createElement('button')
    button.type = 'button'

    const name = document.createElement('span')
    name.textContent = prompt.name
    button.appendChild(name)

    if (prompt.builtin) {
      const badge = document.createElement('span')
      const edited = prompt.id in state.overrides
      badge.className = edited ? 'badge edited' : 'badge'
      badge.textContent = edited ? 'built-in · edited' : 'built-in'
      button.appendChild(badge)
    }

    button.addEventListener('click', () => {
      selectedId = prompt.id
      renderList()
      openEditor(prompt)
    })

    li.appendChild(button)
    list.appendChild(li)
  }
}

// ---- Editor ----

function openEditor(prompt: PromptDefinition): void {
  el('editor').hidden = false
  el<HTMLInputElement>('prompt-name').value = prompt.name
  el<HTMLTextAreaElement>('prompt-template').value = prompt.template
  el('reset-prompt').hidden = !(prompt.builtin && prompt.id in state.overrides)
  el('delete-prompt').hidden = prompt.builtin
}

async function savePrompt(): Promise<void> {
  if (!selectedId) return
  const name = el<HTMLInputElement>('prompt-name').value.trim()
  const template = el<HTMLTextAreaElement>('prompt-template').value

  if (!name || !template.trim()) {
    flashStatus('editor-status', 'Name and template are required.')
    return
  }
  if (!template.includes('{comments}')) {
    flashStatus('editor-status', 'Warning: template has no {comments} placeholder — saved anyway.')
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
    if (!custom) return
    custom.name = name
    custom.template = template
  }

  await savePromptState(state)
  renderList()
  openEditor(allPrompts().find((p) => p.id === selectedId)!)
  if (el('editor-status').textContent === '') {
    flashStatus('editor-status', 'Saved.')
  }
}

async function createPrompt(): Promise<void> {
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

async function resetPrompt(): Promise<void> {
  if (!selectedId || !(selectedId in state.overrides)) return
  delete state.overrides[selectedId]
  await savePromptState(state)
  renderList()
  openEditor(pristineBuiltin(selectedId)!)
  flashStatus('editor-status', 'Reset to default.')
}

async function deletePrompt(): Promise<void> {
  if (!selectedId) return
  const custom = state.customs.find((c) => c.id === selectedId)
  if (!custom) return // built-ins cannot be deleted
  if (!confirm(`Delete the prompt "${custom.name}"? This cannot be undone.`)) return

  state.customs = state.customs.filter((c) => c.id !== selectedId)
  await savePromptState(state)

  // If the deleted prompt was in use, fall back to the default one
  const { selectedPromptId } = await chrome.storage.sync.get({ selectedPromptId: 'default' })
  if (selectedPromptId === selectedId) {
    await chrome.storage.sync.set({ selectedPromptId: 'default' })
  }

  selectedId = null
  el('editor').hidden = true
  renderList()
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
  flashStatus('system-status', 'Saved.')
}

async function resetSystemPrompt(): Promise<void> {
  state.systemPrompt = null
  await savePromptState(state)
  renderSystemPrompt()
  flashStatus('system-status', 'Reset to default.')
}

// ---- Init ----

document.addEventListener('DOMContentLoaded', () => {
  void (async () => {
    state = await getPromptState()
    renderList()
    renderSystemPrompt()
  })()

  el('new-prompt').addEventListener('click', () => void createPrompt())
  el('save-prompt').addEventListener('click', () => void savePrompt())
  el('reset-prompt').addEventListener('click', () => void resetPrompt())
  el('delete-prompt').addEventListener('click', () => void deletePrompt())
  el('save-system').addEventListener('click', () => void saveSystemPrompt())
  el('reset-system').addEventListener('click', () => void resetSystemPrompt())
})
