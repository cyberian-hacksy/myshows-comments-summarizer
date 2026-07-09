// Content script entry point.
import { armCommentsWatcher, initPromptChangeListener } from './ui'
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

  // Insert the button as soon as the comments section exists
  armCommentsWatcher()

  initURLChangeDetection(armCommentsWatcher)
  initPromptChangeListener()

  console.debug('MyShows Comment Summarizer content script finished executing')
}
