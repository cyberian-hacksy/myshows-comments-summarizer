import { mergePrompts } from '../prompts'
import { getPromptState, getSettings } from '../storage'
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
import { watchFor } from './watch-for'

// All styling lives here, keyed off the site's own design tokens (CSS custom
// properties on :root that flip with the html.light-mode/.dark-mode class),
// so the UI adapts to the active theme automatically. Fallbacks are the
// light-theme values. Selectors are scoped under the container id: when a
// hijacked container is released (id removed), the styling dies with it.
const STYLES = `
#comment-summarizer-container {
  --mcs-grad: var(--button-gradient-bg, linear-gradient(88.42deg, #dd0cff 9.62%, #00c8ff 90.87%));
  --mcs-accent: var(--link-color, #06c);
  --mcs-text: var(--font-color, #201f20);
  --mcs-muted: var(--info-color, #999);
  --mcs-surface: var(--modal-bg-color, #fff);
  --mcs-border: var(--border-color, #ccc);
  --mcs-hover: var(--light-gray-bg-color, #eee);
  font-family: var(--font-family, "PT Sans", Arial, Helvetica, sans-serif);
  font-size: var(--main-font-size, 15px);
  color: var(--mcs-text);
}

#comment-summarizer-container .mcs-toolbar {
  display: flex;
  align-items: center;
  margin: 12px 0 14px;
}

/* Split button follows the site's control geometry (1px border, 4px radius,
   flat) like the note/share buttons above it; the sparkle icon is the accent. */
#comment-summarizer-container .mcs-split-button {
  position: relative;
  display: inline-flex;
  align-items: stretch;
  border: 1px solid var(--mcs-border);
  border-radius: var(--field-border-radius, 4px);
  background: transparent;
}
/* Guard: keep the open dropdown above the summary card should the group ever
   become a stacking context. */
#comment-summarizer-container .mcs-split-button.is-open { z-index: 1000; }

#comment-summarizer-container .mcs-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 13px;
  border: 0;
  border-radius: 3px 0 0 3px;
  background: transparent;
  font: inherit;
  font-weight: 700;
  line-height: 20px;
  color: var(--mcs-text);
  cursor: pointer;
  transition: background .15s ease;
  -webkit-font-smoothing: auto;
}
#comment-summarizer-container .mcs-btn:only-child { border-radius: 3px; }
#comment-summarizer-container .mcs-btn:hover:not(:disabled) { background: var(--mcs-hover); }
#comment-summarizer-container .mcs-btn:disabled { cursor: default; opacity: .75; }
#comment-summarizer-container .mcs-icon { display: inline-flex; }

#comment-summarizer-container .mcs-chevron {
  padding: 7px 9px;
  border-left: 1px solid var(--mcs-border);
  border-radius: 0 3px 3px 0;
  color: var(--mcs-muted);
  font-weight: 400;
}
#comment-summarizer-container .mcs-chevron:hover { color: var(--mcs-accent); }
#comment-summarizer-container .mcs-chevron svg { transition: transform .2s ease; }
#comment-summarizer-container .mcs-split-button.is-open .mcs-chevron svg { transform: rotate(180deg); }

#loading-spinner {
  display: none;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, #dd0cff, #00c8ff, transparent 72%);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2.5px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2.5px));
  animation: mcs-rotate .8s linear infinite;
}
@keyframes mcs-rotate { to { transform: rotate(360deg); } }

#prompt-dropdown {
  display: none;
  position: absolute;
  top: calc(100% + 7px);
  left: 0;
  z-index: 1000;
  min-width: 220px;
  padding: 6px;
  border: 1px solid var(--mcs-border);
  border-radius: 10px;
  background: var(--tooltip-myshows-dropdown-bg-color, var(--mcs-surface));
  box-shadow: 0 10px 30px var(--tooltip-myshows-dropdown-shadow, rgba(0, 0, 0, .2));
  animation: mcs-pop .18s ease;
}
@keyframes mcs-pop {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

#comment-summarizer-container .mcs-option {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 11px;
  border-radius: 7px;
  font-size: 14px;
  color: var(--mcs-text);
  cursor: pointer;
  transition: background .15s ease;
}
#comment-summarizer-container .mcs-option::before {
  content: "";
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--mcs-border);
  transition: background .15s ease, box-shadow .15s ease;
}
#comment-summarizer-container .mcs-option:hover { background: var(--mcs-hover); }
#comment-summarizer-container .mcs-option.is-selected { color: var(--mcs-accent); font-weight: 700; }
#comment-summarizer-container .mcs-option.is-selected::before {
  background: var(--mcs-grad);
  box-shadow: 0 0 6px rgba(0, 200, 255, .55);
}

/* The card stays quiet next to site content but is clearly marked as AI
   output: gradient strip on the left edge, gradient title, sparkle icon. */
#summary-container {
  display: none;
  position: relative;
  overflow: hidden;
  margin: 0 0 20px;
  padding: 14px 18px 16px 21px;
  border: 1px solid var(--mcs-border);
  border-radius: 6px;
  background: var(--mcs-surface);
  animation: mcs-rise .35s ease;
}
@keyframes mcs-rise {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
/* Faint gradient wash under the text; paints below content (::before). */
#summary-container::before {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--mcs-grad);
  opacity: .045;
  pointer-events: none;
}
#summary-container::after {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--mcs-grad);
  pointer-events: none;
}

/* Loading stays quiet: the strip and placeholder text pulse together. */
#summary-container.is-loading::after { animation: mcs-pulse 1.2s ease-in-out infinite; }
#summary-container.is-loading #summary-content {
  color: var(--mcs-muted);
  animation: mcs-pulse 1.2s ease-in-out infinite;
}
@keyframes mcs-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .45; }
}

#comment-summarizer-container .mcs-card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-section-color, #eee);
}
#comment-summarizer-container .mcs-card-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--mcs-text);
}
#comment-count {
  font-size: 12px;
  color: var(--mcs-muted);
  white-space: nowrap;
}
#summary-content {
  position: relative;
  font-size: 15px;
  line-height: 1.6;
  white-space: pre-line;
  color: var(--mcs-text);
}
`

// SVG gradient defs live in a page-global id namespace, so every gradient id
// is mcs-prefixed and used by exactly one inline SVG.
const sparklesIcon = (size: number, gradId: string): string => `
<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${gradId}" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
      <stop stop-color="#dd0cff"/>
      <stop offset="1" stop-color="#00c8ff"/>
    </linearGradient>
  </defs>
  <path d="M10 2.8l1.9 5 5 1.9-5 1.9-1.9 5-1.9-5-5-1.9 5-1.9 1.9-5z" fill="url(#${gradId})"/>
  <path d="M18.6 12.8l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1 1-2.6z" fill="url(#${gradId})"/>
</svg>`

const CHEVRON_ICON = `
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

const SETUP_BUTTON_HTML = `
<div class="mcs-toolbar">
  <div class="mcs-split-button">
    <button class="mcs-btn" id="open-api-settings">
      <span class="mcs-icon">${sparklesIcon(16, 'mcs-grad-setup')}</span>
      Set up OpenAI API key for Comment Summarizer
    </button>
  </div>
</div>
`

// Static markup; the prompt name is user-controlled and therefore set via
// textContent after insertion, never interpolated into this HTML.
const SUMMARIZER_HTML = `
<div class="mcs-toolbar">
  <div class="mcs-split-button" id="mcs-split-button">
    <button class="mcs-btn" id="summarize-button">
      <span id="button-icon" class="mcs-icon">${sparklesIcon(16, 'mcs-grad-btn')}</span>
      <span id="loading-spinner"></span>
      <span id="button-text"></span>
    </button>
    <button class="mcs-btn mcs-chevron" id="prompt-selector-button" title="Choose a prompt">${CHEVRON_ICON}</button>
    <div id="prompt-dropdown">
      <div id="prompt-options"></div>
    </div>
  </div>
</div>

<div id="summary-container">
  <div class="mcs-card-head">
    <h3 class="mcs-card-title">${sparklesIcon(17, 'mcs-grad-title')}AI Summary</h3>
    <span id="comment-count"></span>
  </div>
  <div id="summary-content"></div>
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
