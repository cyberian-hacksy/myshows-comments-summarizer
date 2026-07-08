// Content script entry point.
import { INITIAL_DELAY } from './state'
import { initPromptChangeListener, waitForStableDom } from './ui'
import { initURLChangeDetection } from './url-handler'

declare global {
  interface Window {
    myShowsCommentSummarizerLoaded?: boolean
  }
}

console.debug('MyShows Comment Summarizer content script is starting...')

// Prevent multiple script executions
if (window.myShowsCommentSummarizerLoaded) {
  console.debug('Script already loaded, preventing duplicate execution')
} else {
  window.myShowsCommentSummarizerLoaded = true

  // Wait for the page to initialize before attempting to add the button
  console.debug(`Waiting ${INITIAL_DELAY}ms for page to initialize...`)
  setTimeout(waitForStableDom, INITIAL_DELAY)

  initURLChangeDetection(waitForStableDom)
  initPromptChangeListener()

  console.debug('MyShows Comment Summarizer content script finished executing')
}
