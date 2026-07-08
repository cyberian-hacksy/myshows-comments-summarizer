import languagesData from '../../languages.json'
import { loadModelList, MODEL_DESCRIPTIONS } from '../models'
import { fetchAvailableModels } from '../openai'
import { getSettings, saveSettings } from '../storage'
import { DEFAULT_SETTINGS } from '../types'

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

// Store for the selected language
let selectedLanguage = DEFAULT_SETTINGS.summaryLanguage

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T
}

// ---- Model dropdown ----

function populateModelSelect(ids: string[], selected: string): void {
  const select = el<HTMLSelectElement>('model-selection')
  select.replaceChildren()

  // Never lose a saved model just because it vanished from the list
  const allIds = ids.includes(selected) || !selected ? ids : [...ids, selected].sort()

  const isSmall = (id: string) => /mini|nano/.test(id)
  const groups: Array<[string, string[]]> = [
    ['Full-sized models', allIds.filter((id) => !isSmall(id))],
    ['Smaller models (faster & more affordable)', allIds.filter(isSmall)],
  ]

  for (const [label, groupIds] of groups) {
    if (!groupIds.length) continue
    const optgroup = document.createElement('optgroup')
    optgroup.label = label
    for (const id of groupIds) {
      const option = document.createElement('option')
      option.value = id
      option.textContent = id
      optgroup.appendChild(option)
    }
    select.appendChild(optgroup)
  }

  if (selected) select.value = selected
  updateModelDescription()
}

function updateModelDescription(): void {
  const select = el<HTMLSelectElement>('model-selection')
  el('model-description').textContent = MODEL_DESCRIPTIONS[select.value] ?? ''
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
      const current = el<HTMLSelectElement>('model-selection').value
      populateModelSelect(ids, current || selected)
      if (fetching) {
        el('model-description').textContent = 'Loading model list from OpenAI…'
      }
    },
  })
  if (seq === modelLoadSeq) {
    updateModelDescription()
    if (outcome === 'error') {
      showStatus('Could not load the model list from OpenAI — using the fallback list.', 'error')
    }
  }
  return outcome === 'live'
}

// ---- Language dropdown ----

function populateLanguageDropdown(languages: Language[]): void {
  const optionsContainer = el('language-options')
  optionsContainer.replaceChildren()

  for (const lang of languages) {
    const option = document.createElement('div')
    option.className = 'dropdown-option'
    option.dataset.value = lang.name.toLowerCase()
    option.textContent = `${lang.name} (${lang.nativeName})`

    // Make option focusable and accessible
    option.setAttribute('tabindex', '0')
    option.setAttribute('role', 'option')

    // Mark as selected if it matches the current selection
    if (selectedLanguage && lang.name.toLowerCase() === selectedLanguage) {
      option.classList.add('selected')
      option.setAttribute('aria-selected', 'true')
      el('selected-language').textContent = `${lang.name} (${lang.nativeName})`
    } else {
      option.setAttribute('aria-selected', 'false')
    }

    option.addEventListener('click', function (this: HTMLElement) {
      selectLanguage(this)
    })

    optionsContainer.appendChild(option)
  }

  optionsContainer.setAttribute('role', 'listbox')
  optionsContainer.setAttribute('aria-label', 'Languages')
}

function selectLanguage(optionElement: HTMLElement): void {
  selectedLanguage = optionElement.dataset.value ?? selectedLanguage

  el('selected-language').textContent = optionElement.textContent

  const options = el('language-options').querySelectorAll('.dropdown-option')
  options.forEach((opt) => {
    opt.classList.remove('selected')
    opt.setAttribute('aria-selected', 'false')
  })
  optionElement.classList.add('selected')
  optionElement.setAttribute('aria-selected', 'true')

  el('dropdown-menu').style.display = 'none'
  el('selected-language').setAttribute('aria-expanded', 'false')
}

function filterLanguages(searchText: string): Language[] {
  if (!searchText) {
    return languagesList
  }
  const needle = searchText.toLowerCase()
  return languagesList.filter(
    (lang) =>
      lang.name.toLowerCase().includes(needle) ||
      lang.nativeName.toLowerCase().includes(needle) ||
      lang.code.toLowerCase().includes(needle),
  )
}

function setupDropdown(): void {
  const dropdownSelected = el('selected-language')
  const dropdownMenu = el('dropdown-menu')
  const searchInput = el<HTMLInputElement>('language-search')
  const optionsContainer = el('language-options')

  // Make dropdown accessible
  dropdownSelected.setAttribute('tabindex', '0')
  dropdownSelected.setAttribute('role', 'combobox')
  dropdownSelected.setAttribute('aria-expanded', 'false')
  dropdownSelected.setAttribute('aria-controls', 'dropdown-menu')

  function toggleDropdown(open?: boolean): void {
    const isOpen = open !== undefined ? open : dropdownMenu.style.display !== 'block'

    dropdownMenu.style.display = isOpen ? 'block' : 'none'
    dropdownSelected.setAttribute('aria-expanded', isOpen ? 'true' : 'false')

    if (isOpen) {
      searchInput.focus()
    }
  }

  dropdownSelected.addEventListener('click', () => toggleDropdown())

  dropdownSelected.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault()
      toggleDropdown(true)
    }
  })

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const target = e.target as Node
    if (!dropdownSelected.contains(target) && !dropdownMenu.contains(target)) {
      toggleDropdown(false)
    }
  })

  searchInput.addEventListener('input', function (this: HTMLInputElement) {
    populateLanguageDropdown(filterLanguages(this.value))
  })

  // Prevent dropdown from closing when clicking on search input
  searchInput.addEventListener('click', (e) => e.stopPropagation())

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      toggleDropdown(false)
      dropdownSelected.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const firstOption = optionsContainer.querySelector<HTMLElement>('.dropdown-option')
      firstOption?.focus()
    }
  })

  // Keyboard navigation between options
  optionsContainer.addEventListener('keydown', (e) => {
    const options = Array.from(optionsContainer.querySelectorAll<HTMLElement>('.dropdown-option'))
    const active = document.activeElement as HTMLElement
    const currentIndex = options.indexOf(active)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (currentIndex < options.length - 1) {
        options[currentIndex + 1]?.focus()
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (currentIndex > 0) {
        options[currentIndex - 1]?.focus()
      } else {
        searchInput.focus()
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (active.classList.contains('dropdown-option')) {
        selectLanguage(active)
      }
    } else if (e.key === 'Escape') {
      toggleDropdown(false)
      dropdownSelected.focus()
    }
  })
}

// ---- Other controls ----

function updateTemperatureValue(): void {
  el('temperature-value').textContent = el<HTMLInputElement>('temperature-slider').value
}

function showStatus(message: string, kind: 'success' | 'error' = 'success'): void {
  const status = el('status')
  status.textContent = message
  status.className = `status ${kind}`
  setTimeout(() => {
    status.textContent = ''
    status.className = 'status'
  }, 2000)
}

let savedApiKey = ''

async function saveOptions(): Promise<void> {
  const apiKey = el<HTMLInputElement>('openai-api-key').value.trim()
  const keyChanged = apiKey !== savedApiKey

  await saveSettings({
    openaiApiKey: apiKey,
    selectedModel: el<HTMLSelectElement>('model-selection').value,
    summaryLanguage: selectedLanguage,
    temperature: parseFloat(el<HTMLInputElement>('temperature-slider').value),
    maxTokens: parseInt(el<HTMLSelectElement>('max-tokens').value, 10),
    selectedPromptId: (await getSettings()).selectedPromptId,
  })
  savedApiKey = apiKey
  showStatus('Settings saved.')

  // A different key can see a different model roster — refresh it
  if (keyChanged && apiKey) {
    await loadModels(apiKey, el<HTMLSelectElement>('model-selection').value, true)
  }
}

async function restoreOptions(): Promise<void> {
  const settings = await getSettings()

  el<HTMLInputElement>('openai-api-key').value = settings.openaiApiKey
  savedApiKey = settings.openaiApiKey
  selectedLanguage = settings.summaryLanguage
  el<HTMLInputElement>('temperature-slider').value = String(settings.temperature)
  el<HTMLSelectElement>('max-tokens').value = String(settings.maxTokens)
  updateTemperatureValue()

  // Settings are loaded before the dropdowns are populated, so the saved
  // language/model are highlighted correctly (no async race).
  populateLanguageDropdown(languagesList)

  await loadModels(settings.openaiApiKey, settings.selectedModel)
}

document.addEventListener('DOMContentLoaded', () => {
  void restoreOptions().then(setupDropdown)

  el('save-button').addEventListener('click', () => void saveOptions())
  el('open-options').addEventListener('click', () => chrome.runtime.openOptionsPage())
  el<HTMLSelectElement>('model-selection').addEventListener('change', updateModelDescription)
  el<HTMLInputElement>('temperature-slider').addEventListener('input', updateTemperatureValue)
  el('refresh-models').addEventListener('click', () => {
    const apiKey = el<HTMLInputElement>('openai-api-key').value.trim()
    const selected = el<HTMLSelectElement>('model-selection').value
    void loadModels(apiKey, selected, true).then((live) => {
      if (live) showStatus('Model list updated.')
      else if (!apiKey) showStatus('Enter an API key first to load your models.', 'error')
    })
  })
})
