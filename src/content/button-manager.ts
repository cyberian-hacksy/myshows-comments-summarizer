import { state } from './state'

// Check if our button still exists and handle duplicates.
export function checkButtonExists(tryAddButton: () => void): void {
  const containers = document.querySelectorAll('#comment-summarizer-container')
  const commentsSection = document.getElementById('comments')

  if (containers.length === 0 && commentsSection && state.buttonAdded) {
    // Button was removed, re-add it
    console.debug('Button container was removed, re-adding')
    state.buttonAdded = false
    tryAddButton()
  } else if (containers.length > 1) {
    // Multiple containers found, remove all but the first
    console.debug(`Found ${containers.length} containers, removing duplicates`)
    for (let i = 1; i < containers.length; i++) {
      containers[i]?.remove()
    }
  }
}
