// Insertion and lifecycle of the on-site UI; styles and markup live in
// templates.ts.
import { getSettings, loadActivePrompts } from '../storage'
import { healContainer } from './button-manager'
import {
  areCommentsLoaded,
  cleanupExistingElements,
  getPromptDisplayName,
  hasShowCommentsButton,
} from './dom-utils'
import { setupPromptSelector } from './prompt-selector'
import { HYDRATION_GRACE_MS, state } from './state'
import { handleSummarizeClick } from './summarize'
import { SETUP_BUTTON_HTML, STYLES, SUMMARIZER_HTML } from './templates'
import { watchFor } from './watch-for'

async function currentPromptName(): Promise<string> {
  const { settings, prompts } = await loadActivePrompts()
  return getPromptDisplayName(prompts, settings.selectedPromptId)
}

// Function that actually adds our button.
export async function tryAddButton(): Promise<void> {
  if (state.buttonAdded || state.isAddingButton) {
    console.debug('Button already added or in progress, skipping')
    return
  }

  // Give SSR hydration time to finish before touching the DOM for the first
  // time — hydration adopts foreign nodes it finds inside the app root. The
  // self-heal in healContainer() covers us if this window is ever too short.
  if (!state.hydrationGraceElapsed) {
    if (state.hydrationGraceTimer === null) {
      console.debug(`Delaying first insertion by ${HYDRATION_GRACE_MS}ms for hydration`)
      state.hydrationGraceTimer = window.setTimeout(() => {
        state.hydrationGraceTimer = null
        state.hydrationGraceElapsed = true
        void tryAddButton()
      }, HYDRATION_GRACE_MS)
    }
    return
  }

  // Clean up any existing elements first
  cleanupExistingElements()

  // Check if comments section exists
  const commentsSection = document.getElementById('comments')
  if (!commentsSection) {
    console.debug('Comments section not found')
    return
  }

  // Comments hidden behind the site's "Show Comments" button: add our button
  // the moment the comments render (after the user clicks it)
  if (!areCommentsLoaded() && hasShowCommentsButton()) {
    console.debug('Comments not loaded yet, waiting for them to render')
    state.cancelWatch?.()
    state.cancelWatch = watchFor(areCommentsLoaded, () => {
      state.buttonAdded = false
      void tryAddButton()
    })
    return
  }

  console.debug('Found comments section, adding button...')

  state.isAddingButton = true

  const settings = await getSettings()

  // Styles live in <head>, outside the container, so a hijacking framework
  // can't swallow them; cleanupExistingElements() removes them by attribute.
  const styleElement = document.createElement('style')
  styleElement.setAttribute('data-comment-summarizer', 'true')
  styleElement.textContent = STYLES
  document.head.appendChild(styleElement)

  // Create the container for our elements
  const container = document.createElement('div')
  container.id = 'comment-summarizer-container'
  container.style.cssText = 'padding: 0 20px; margin-bottom: 15px;'
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

    setupPromptSelector()

    document
      .getElementById('summarize-button')
      ?.addEventListener('click', () => void handleSummarizeClick())
  }

  state.buttonAdded = true
  state.isAddingButton = false
  console.debug('Button successfully added to page')

  // Set up a periodic check to make sure our button stays there and intact
  if (state.buttonCheckInterval) {
    clearInterval(state.buttonCheckInterval)
  }
  state.buttonCheckInterval = window.setInterval(
    () => healContainer(() => void tryAddButton()),
    2000,
  )
}

// Insert the container as soon as the comments section exists. Re-arming
// (e.g. after an SPA navigation) replaces any previously armed watcher.
export function armCommentsWatcher(): void {
  state.cancelWatch?.()
  state.cancelWatch = watchFor(
    () => !!document.getElementById('comments'),
    () => void tryAddButton(),
  )
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
