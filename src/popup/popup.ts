import languagesData from '../../languages.json'
import { loadModelList, writeModelCache } from '../models'
import { fetchAvailableModels } from '../openai'
import { estimateOutputCost, formatCost, loadPricing, priceLabel } from '../pricing'
import type { PricingMap } from '../pricing'
import { getSettings, saveSettings } from '../storage'
import type { Settings } from '../types'
import { debounce } from '../ui/debounce'
import { el } from '../ui/dom'
import { createSearchableDropdown, type DropdownGroup } from '../ui/searchable-dropdown'
import { sparklesIcon } from '../ui/sparkles'
import { showToast } from '../ui/toast'
import { verifyKey } from './verify-key'

interface Language {
  code: string
  name: string
  nativeName: string
}

// Build the sorted language list from the bundled languages.json
const languagesList: Language[] = Object.entries(
  (languagesData as { lang: Record<string, string[]> }).lang,
)
  .map(([code, names]) => ({
    code,
    name: names[0] ?? code,
    nativeName: names[1] ?? names[0] ?? code,
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

// Static SVGs — no user content involved.
const EYE_ICON = `
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" stroke="currentColor" stroke-width="1.8"/>
  <circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.8"/>
</svg>`

const EYE_OFF_ICON = `
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" stroke="currentColor" stroke-width="1.8"/>
  <circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.8"/>
  <path d="M4 20 20 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
</svg>`

// ---- Settings persistence (auto-save) ----

let settings: Settings

async function persist(partial: Partial<Settings>): Promise<void> {
  // selectedPromptId can change from the on-site dropdown while the popup is
  // open — re-read it so a save here never clobbers that choice.
  const { selectedPromptId } = await getSettings()
  settings = { ...settings, ...partial, selectedPromptId }
  await saveSettings(settings)
  showToast('Saved.')
}

// ---- Model dropdown ----

// Prices per 1M tokens; empty until loadPricing resolves, then groups are repainted.
let pricingMap: PricingMap = {}
let modelIds: string[] = []

const modelDropdown = createSearchableDropdown({
  placeholder: 'Select a model',
  searchPlaceholder: 'Search models…',
  onSelect: (value) => {
    updateCostEstimate()
    void persist({ selectedModel: value })
  },
})

const languageDropdown = createSearchableDropdown({
  placeholder: 'Select a language',
  searchPlaceholder: 'Search languages…',
  onSelect: (value) => void persist({ summaryLanguage: value }),
})

function modelGroups(ids: string[]): DropdownGroup[] {
  // Never lose a saved model just because it vanished from the list
  const selected = modelDropdown.getSelected()
  const allIds = ids.includes(selected) || !selected ? ids : [...ids, selected].sort()

  const isSmall = (id: string) => /mini|nano/.test(id)
  const toOption = (id: string) => ({ value: id, label: id, sublabel: priceLabel(pricingMap[id]) })
  return [
    { label: 'Full-sized models', options: allIds.filter((id) => !isSmall(id)).map(toOption) },
    {
      label: 'Smaller models (faster & more affordable)',
      options: allIds.filter(isSmall).map(toOption),
    },
  ].filter((group) => group.options.length)
}

function paintModels(ids: string[]): void {
  modelIds = ids
  modelDropdown.setGroups(modelGroups(ids))
}

function updateCostEstimate(): void {
  const pricing = pricingMap[modelDropdown.getSelected()]
  let text = ''
  if (pricing) {
    const maxTokens = parseInt(el<HTMLSelectElement>('max-tokens').value, 10)
    const estimate = estimateOutputCost(pricing, maxTokens, modelDropdown.getSelected())
    text = `Output cost up to ~${formatCost(estimate)} per summary`
  }
  el('model-description').textContent = text
}

/** Once prices arrive, repaint the groups in place (selection is preserved). */
async function loadPrices(): Promise<void> {
  pricingMap = await loadPricing()
  paintModels(modelIds)
  updateCostEstimate()
}

let modelLoadSeq = 0

/**
 * Two-phase load: paint instantly from cache/defaults, then update in place
 * once the live list arrives. Failures are surfaced instead of silently
 * showing the fallback list. Returns true when the live list was applied.
 */
async function loadModels(apiKey: string, selected: string, force = false): Promise<boolean> {
  const seq = ++modelLoadSeq
  const outcome = await loadModelList({
    apiKey,
    fetcher: fetchAvailableModels,
    force,
    onUpdate: (ids, fetching) => {
      if (seq !== modelLoadSeq) return // superseded by a newer load
      if (!modelDropdown.getSelected() && selected) modelDropdown.setSelected(selected)
      paintModels(ids)
      if (fetching) {
        el('model-description').textContent = 'Loading model list from OpenAI…'
      }
    },
  })
  if (seq === modelLoadSeq) {
    updateCostEstimate()
    if (outcome === 'error') {
      showToast('Could not load the model list — using the fallback list.', 'error')
    }
  }
  return outcome === 'live'
}

// ---- API key ----

function currentKey(): string {
  return el<HTMLInputElement>('openai-api-key').value.trim()
}

const persistKey = debounce((apiKey: string) => {
  const keyChanged = apiKey !== settings.openaiApiKey
  void persist({ openaiApiKey: apiKey }).then(() => {
    // A different key can see a different model roster — refresh it
    if (keyChanged && apiKey) void loadModels(apiKey, modelDropdown.getSelected(), true)
  })
}, 600)

async function testKey(): Promise<void> {
  const button = el<HTMLButtonElement>('test-key')
  button.disabled = true
  // Capture the roster the check fetches so success doubles as a refresh.
  let ids: string[] = []
  const result = await verifyKey(currentKey(), async (key) => {
    ids = await fetchAvailableModels(key)
    return ids
  })
  button.disabled = false
  if (result.ok) {
    showToast(`Key works — ${result.modelCount} models available.`)
    await writeModelCache(ids, Date.now())
    paintModels(ids)
  } else {
    showToast(result.message, 'error')
  }
}

// ---- Init ----

async function restoreOptions(): Promise<void> {
  settings = await getSettings()

  el<HTMLInputElement>('openai-api-key').value = settings.openaiApiKey
  el<HTMLInputElement>('temperature-slider').value = String(settings.temperature)
  el<HTMLSelectElement>('max-tokens').value = String(settings.maxTokens)
  updateTemperature()

  // Selections are set before the dropdowns are populated, so the saved
  // language/model are highlighted correctly (no async race).
  languageDropdown.setGroups([
    {
      options: languagesList.map((lang) => ({
        value: lang.name.toLowerCase(),
        label: `${lang.name} (${lang.nativeName})`,
        keywords: `${lang.nativeName} ${lang.code}`,
      })),
    },
  ])
  languageDropdown.setSelected(settings.summaryLanguage)
  modelDropdown.setSelected(settings.selectedModel)

  // Prices load in parallel with the model list; whichever lands last wins
  // because both repaint labels from the shared pricingMap.
  const pricesReady = loadPrices().catch((error) => console.warn('Pricing load failed', error))
  await loadModels(settings.openaiApiKey, settings.selectedModel)
  await pricesReady
}

function updateTemperature(): void {
  const slider = el<HTMLInputElement>('temperature-slider')
  el('temperature-value').textContent = slider.value
  slider.style.setProperty('--mcs-range-fill', `${parseFloat(slider.value) * 100}%`)
}

document.addEventListener('DOMContentLoaded', () => {
  el('title-icon').innerHTML = sparklesIcon(18, 'mcs-grad-popup')
  el('key-reveal').innerHTML = EYE_ICON
  el('model-dd').appendChild(modelDropdown.element)
  el('language-dd').appendChild(languageDropdown.element)

  void restoreOptions()

  el('open-options').addEventListener('click', () => chrome.runtime.openOptionsPage())
  el('test-key').addEventListener('click', () => void testKey())

  el('openai-api-key').addEventListener('input', () => persistKey(currentKey()))

  el('key-reveal').addEventListener('click', () => {
    const input = el<HTMLInputElement>('openai-api-key')
    const reveal = input.type === 'password'
    input.type = reveal ? 'text' : 'password'
    el('key-reveal').innerHTML = reveal ? EYE_OFF_ICON : EYE_ICON
    el('key-reveal').title = reveal ? 'Hide key' : 'Show key'
    el('key-reveal').setAttribute('aria-label', el('key-reveal').title)
  })

  el<HTMLSelectElement>('max-tokens').addEventListener('change', () => {
    updateCostEstimate()
    void persist({ maxTokens: parseInt(el<HTMLSelectElement>('max-tokens').value, 10) })
  })

  const slider = el<HTMLInputElement>('temperature-slider')
  slider.addEventListener('input', updateTemperature)
  slider.addEventListener('change', () =>
    void persist({ temperature: parseFloat(slider.value) }),
  )

  el('refresh-models').addEventListener('click', () => {
    const apiKey = currentKey()
    void loadModels(apiKey, modelDropdown.getSelected(), true).then((live) => {
      if (live) showToast('Model list updated.')
      else if (!apiKey) showToast('Enter an API key first to load your models.', 'error')
    })
  })
})
