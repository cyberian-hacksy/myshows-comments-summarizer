import { mergePrompts } from '../prompts'
import { getPromptState, getSettings } from '../storage'
import { checkButtonExists } from './button-manager'
import { setupCommentsLoadObserver } from './comments-observer'
import {
  areCommentsLoaded,
  cleanupExistingElements,
  getPromptDisplayName,
  hasShowCommentsButton,
} from './dom-utils'
import { setupPromptSelector } from './prompt-selector'
import { state, STABILITY_THRESHOLD, STABILITY_WAIT_TIME } from './state'
import { handleSummarizeClick } from './summarize'

const SETUP_BUTTON_HTML = `
<button class="summarize-button" id="open-api-settings" style="
    align-items: center;
    background: transparent;
    border: 0;
    box-shadow: none;
    color: #3ec1ff;
    cursor: pointer;
    display: inline-flex;
    font-size: 16px;
    justify-content: center;
    line-height: 24px;
    padding: 0;
    text-align: left;
    -webkit-font-smoothing: auto;
    margin: 10px 0;
">
    <span style="margin-right: 6px; display: inline-flex;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-13a1 1 0 0 0-1 1v5a1 1 0 0 0 2 0V8a1 1 0 0 0-1-1zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" fill="currentColor"/>
        </svg>
    </span>
    Set up OpenAI API key for Comment Summarizer
</button>
`

// Static markup; the prompt name is user-controlled and therefore set via
// textContent after insertion, never interpolated into this HTML.
const SUMMARIZER_HTML = `
<div style="display: flex; align-items: center; gap: 8px; margin: 10px 0;">
    <button class="summarize-button" id="summarize-button" style="
        align-items: center;
        background: transparent;
        border: 0;
        box-shadow: none;
        color: #3ec1ff;
        cursor: pointer;
        display: inline-flex;
        font-size: 16px;
        justify-content: center;
        line-height: 24px;
        padding: 0;
        text-align: left;
        -webkit-font-smoothing: auto;
    ">
        <span id="button-icon" style="
            margin-right: 6px;
            display: inline-flex;
        ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 5h16v2H4V5zm0 6h16v2H4v-2zm0 6h16v2H4v-2z" fill="currentColor"/>
            </svg>
        </span>
        <span id="loading-spinner" style="
            display: none;
            width: 16px;
            height: 16px;
            border: 2px solid rgba(62, 193, 255, 0.2);
            border-radius: 50%;
            border-top-color: #3ec1ff;
            animation: spin 1s ease-in-out infinite;
            margin-right: 8px;
        "></span>
        <span id="button-text"></span>
    </button>

    <div style="position: relative;">
        <button id="prompt-selector-button" style="
            background: transparent;
            border: none;
            color: #3ec1ff;
            cursor: pointer;
            padding: 2px;
            font-size: 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        ">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 10l5 5 5-5z" fill="currentColor"/>
            </svg>
        </button>

        <div id="prompt-dropdown" style="
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            background: #2a2a2a;
            border: 1px solid #444;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 1000;
            min-width: 180px;
            margin-top: 2px;
        ">
            <div id="prompt-options"></div>
        </div>
    </div>
</div>

<div id="summary-container" style="
    display: none;
    background-color: #474747;
    border-radius: 8px;
    padding: 15px;
    margin: 10px 20px 20px 0;
    color: #e8e8e8;
">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h3 style="font-size: 16px; font-weight: bold; margin: 0;">AI Generated Content</h3>
        <span id="comment-count" style="color: #ccc; font-size: 14px;"></span>
    </div>
    <div id="summary-content" style="line-height: 1.5; white-space: pre-line;"></div>
</div>
`

async function currentPromptName(): Promise<string> {
  const [settings, promptState] = await Promise.all([getSettings(), getPromptState()])
  const prompts = mergePrompts(promptState.overrides, promptState.customs)
  return getPromptDisplayName(prompts, settings.selectedPromptId)
}

// Function that actually adds our button.
export async function tryAddButton(): Promise<void> {
  if (state.buttonAdded || state.isAddingButton) {
    console.debug('Button already added or in progress, skipping')
    return
  }

  // Clean up any existing elements first
  cleanupExistingElements()

  // Check if comments section exists
  const commentsSection = document.getElementById('comments')
  if (!commentsSection) {
    console.debug('Comments section not found, will try again later')
    setTimeout(() => void tryAddButton(), 1000)
    return
  }

  // If comments aren't loaded and there's a "Show Comments" button,
  // observe for when it's clicked instead of showing our button immediately
  if (!areCommentsLoaded() && hasShowCommentsButton()) {
    console.debug("Comments not loaded yet, waiting for 'Show Comments' button to be clicked")
    setupCommentsLoadObserver(() => void tryAddButton())
    return
  }

  console.debug('Found comments section, adding button...')

  state.isAddingButton = true

  const settings = await getSettings()

  // Create the container for our elements
  const container = document.createElement('div')
  container.id = 'comment-summarizer-container'
  container.style.cssText = 'padding-left: 20px; margin-bottom: 15px;'
  container.setAttribute('data-comment-summarizer', 'true')

  if (!settings.openaiApiKey) {
    // No API key - show setup prompt
    container.innerHTML = SETUP_BUTTON_HTML
    commentsSection.parentNode?.insertBefore(container, commentsSection)

    document.getElementById('open-api-settings')?.addEventListener('click', (e) => {
      e.preventDefault()
      alert('Please click on the extension icon in the toolbar to set up your OpenAI API key.')
    })
  } else {
    // API key exists - show summarize button with prompt selector
    container.innerHTML = SUMMARIZER_HTML
    commentsSection.parentNode?.insertBefore(container, commentsSection)

    const buttonText = document.getElementById('button-text')
    if (buttonText) buttonText.textContent = await currentPromptName()

    // Add spin animation style
    const styleElement = document.createElement('style')
    styleElement.setAttribute('data-comment-summarizer', 'true')
    styleElement.textContent = `
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`
    document.head.appendChild(styleElement)

    setupPromptSelector()

    document
      .getElementById('summarize-button')
      ?.addEventListener('click', () => void handleSummarizeClick())
  }

  state.buttonAdded = true
  state.isAddingButton = false
  console.debug('Button successfully added to page')

  // Set up a periodic check to make sure our button stays there
  if (state.buttonCheckInterval) {
    clearInterval(state.buttonCheckInterval)
  }
  state.buttonCheckInterval = window.setInterval(
    () => checkButtonExists(() => void tryAddButton()),
    2000,
  )
}

// Wait for DOM to settle down before adding button.
export function waitForStableDom(): void {
  console.debug('Waiting for DOM to stabilize...')

  if (state.stabilityTimer) clearTimeout(state.stabilityTimer)

  // Record the current time as the last DOM change time
  state.lastDomChangeTime = Date.now()

  // Stop any existing observer
  if (state.stabilityObserver) {
    state.stabilityObserver.disconnect()
  }

  // Detect when DOM changes stop happening
  state.stabilityObserver = new MutationObserver(() => {
    state.lastDomChangeTime = Date.now()

    if (state.stabilityTimer) {
      clearTimeout(state.stabilityTimer)
    }
    state.stabilityTimer = window.setTimeout(checkDomStability, STABILITY_WAIT_TIME)
  })

  state.stabilityObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
  })

  state.stabilityTimer = window.setTimeout(checkDomStability, STABILITY_WAIT_TIME)
}

// Check if the DOM has been stable long enough.
function checkDomStability(): void {
  const timeSinceLastChange = Date.now() - state.lastDomChangeTime

  if (timeSinceLastChange >= STABILITY_THRESHOLD) {
    console.debug(`DOM appears stable (no changes for ${timeSinceLastChange}ms)`)

    if (state.stabilityObserver) {
      state.stabilityObserver.disconnect()
      state.stabilityObserver = null
    }

    void tryAddButton()
  } else {
    console.debug(`DOM still changing (${timeSinceLastChange}ms since last change)`)
    state.stabilityTimer = window.setTimeout(checkDomStability, STABILITY_WAIT_TIME)
  }
}

// Keep the button label in sync when prompts or the selection change
// (e.g. edited on the options page while a myshows tab is open).
export function initPromptChangeListener(): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return
    if (!('promptOverrides' in changes || 'customPrompts' in changes || 'selectedPromptId' in changes)) {
      return
    }
    const buttonText = document.getElementById('button-text')
    if (!buttonText) return
    void currentPromptName().then((name) => {
      // Don't clobber the transient "Analyzing..." label
      const button = document.getElementById('summarize-button') as HTMLButtonElement | null
      if (button && !button.disabled) buttonText.textContent = name
    })
  })
}
