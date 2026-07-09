import { mergePrompts } from '../prompts'
import { getPromptState, getSettings } from '../storage'
import { getPromptDisplayName } from './dom-utils'
import { handleSummarizeClick } from './summarize'

// Keep track of the document click handler so we don't attach duplicates
let documentClickHandler: ((e: MouseEvent) => void) | null = null

// Set up the prompt selector dropdown next to the summarize button.
export function setupPromptSelector(): void {
  const selectorButton = document.getElementById('prompt-selector-button')
  const dropdown = document.getElementById('prompt-dropdown')
  const optionsContainer = document.getElementById('prompt-options')

  if (!selectorButton || !dropdown || !optionsContainer) {
    console.error('Prompt selector elements not found')
    return
  }

  // The split button hosts the chevron; the is-open class drives its rotation.
  const splitButton = document.getElementById('mcs-split-button')

  const setDropdownOpen = (open: boolean): void => {
    dropdown.style.display = open ? 'block' : 'none'
    splitButton?.classList.toggle('is-open', open)
  }

  // Rebuild dropdown options from the merged prompt list. Prompt names are
  // user-controlled, so build nodes with textContent — never innerHTML.
  async function populateOptions(): Promise<void> {
    const [settings, promptState] = await Promise.all([getSettings(), getPromptState()])
    const prompts = mergePrompts(promptState.overrides, promptState.customs)
    const selectedId = settings.selectedPromptId

    optionsContainer!.replaceChildren()

    prompts.forEach((prompt) => {
      const option = document.createElement('div')
      option.className = prompt.id === selectedId ? 'mcs-option is-selected' : 'mcs-option'
      option.dataset.prompt = prompt.id
      option.textContent = prompt.name

      option.addEventListener('click', async () => {
        const promptChanged = prompt.id !== selectedId

        await chrome.storage.sync.set({ selectedPromptId: prompt.id })

        const buttonText = document.getElementById('button-text')
        if (buttonText) {
          buttonText.textContent = getPromptDisplayName(prompts, prompt.id)
        }

        setDropdownOpen(false)

        // Trigger summarization if prompt changed
        if (promptChanged) {
          void handleSummarizeClick()
        }
      })

      optionsContainer!.appendChild(option)
    })
  }

  // Toggle dropdown
  selectorButton.addEventListener('click', (e) => {
    e.stopPropagation()

    if (dropdown.style.display === 'none' || dropdown.style.display === '') {
      void populateOptions().then(() => {
        setDropdownOpen(true)
      })
    } else {
      setDropdownOpen(false)
    }
  })

  // Close dropdown when clicking outside. Remove previous handler if any to
  // avoid stacking multiple listeners when the UI is re-rendered.
  if (documentClickHandler) {
    document.removeEventListener('click', documentClickHandler)
  }

  documentClickHandler = (e: MouseEvent) => {
    const target = e.target as Node
    if (!dropdown.contains(target) && !selectorButton.contains(target)) {
      setDropdownOpen(false)
    }
  }

  document.addEventListener('click', documentClickHandler)
}
