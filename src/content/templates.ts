// Static styles and markup for the on-site UI.
import { sparklesIcon } from '../ui/sparkles'

// All styling lives here, keyed off the site's own design tokens (CSS custom
// properties on :root that flip with the html.light-mode/.dark-mode class),
// so the UI adapts to the active theme automatically. Fallbacks are the
// light-theme values. Selectors are scoped under the container id: when a
// hijacked container is released (id removed), the styling dies with it.
export const STYLES = `
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

const CHEVRON_ICON = `
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

export const SETUP_BUTTON_HTML = `
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
export const SUMMARIZER_HTML = `
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
