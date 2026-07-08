import { mergePrompts } from '../prompts'
import { getPromptState, getSettings } from '../storage'
import { getPromptDisplayName } from './dom-utils'
import { handleSummarizeClick } from './summarize'

// Keep track of the document click handler so we don't attach duplicates
let documentClickHandler: ((e: MouseEvent) => void) | null = null

const SELECTED_BG = '#3ec1ff'
const SELECTED_FG = '#000'
const IDLE_FG = '#e8e8e8'

// Set up the prompt selector dropdown next to the summarize button.
export function setupPromptSelector(): void {
  const selectorButton = document.getElementById('prompt-selector-button')
  const dropdown = document.getElementById('prompt-dropdown')
  const optionsContainer = document.getElementById('prompt-options')

  if (!selectorButton || !dropdown || !optionsContainer) {
    console.error('Prompt selector elements not found')
    return
  }

  // Rebuild dropdown options from the merged prompt list. Prompt names are
  // user-controlled, so build nodes with textContent — never innerHTML.
  async function populateOptions(): Promise<void> {
    const [settings, promptState] = await Promise.all([getSettings(), getPromptState()])
    const prompts = mergePrompts(promptState.overrides, promptState.customs)
    const selectedId = settings.selectedPromptId

    optionsContainer!.replaceChildren()

    prompts.forEach((prompt, index) => {
      const option = document.createElement('div')
      option.className = 'prompt-option'
      option.dataset.prompt = prompt.id
      option.textContent = prompt.name
      const isSelected = prompt.id === selectedId
      option.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: ${index === prompts.length - 1 ? 'none' : '1px solid #444'};
        color: ${isSelected ? SELECTED_FG : IDLE_FG};
        font-size: 14px;
        background-color: ${isSelected ? SELECTED_BG : 'transparent'};
      `

      option.addEventListener('mouseenter', () => {
        if (option.dataset.prompt !== selectedId) {
          option.style.backgroundColor = '#444'
        }
      })
      option.addEventListener('mouseleave', () => {
        if (option.dataset.prompt !== selectedId) {
          option.style.backgroundColor = 'transparent'
        }
      })

      option.addEventListener('click', async () => {
        const promptChanged = prompt.id !== selectedId

        await chrome.storage.sync.set({ selectedPromptId: prompt.id })

        const buttonText = document.getElementById('button-text')
        if (buttonText) {
          buttonText.textContent = getPromptDisplayName(prompts, prompt.id)
        }

        dropdown!.style.display = 'none'

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
        dropdown.style.display = 'block'
      })
    } else {
      dropdown.style.display = 'none'
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
      dropdown.style.display = 'none'
    }
  }

  document.addEventListener('click', documentClickHandler)
}
