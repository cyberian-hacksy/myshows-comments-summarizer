import { areCommentsLoaded } from './dom-utils'
import { state } from './state'

// Wait for comments to be loaded (behind the "Show Comments" button), then
// hand control back so the summarize button can be added.
export function setupCommentsLoadObserver(onCommentsLoaded: () => void): void {
  console.debug('Setting up observer for comment loading')

  const showButton = document.querySelector('.Episode-commentsShow')

  if (showButton) {
    // Detect when the button is clicked, then watch for comments to appear
    showButton.addEventListener('click', () => {
      console.debug("'Show Comments' button clicked, waiting for comments to load")

      const commentsObserver = new MutationObserver(() => {
        if (areCommentsLoaded()) {
          console.debug('Comments have been loaded')
          commentsObserver.disconnect()

          // Wait a bit for the comments to fully render
          setTimeout(() => {
            state.buttonAdded = false
            onCommentsLoaded()
          }, 1000)
        }
      })

      commentsObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      })

      // Stop watching if comments never load
      setTimeout(() => {
        commentsObserver.disconnect()
      }, 10000)
    })

    console.debug("Added listener to 'Show Comments' button")
  } else {
    console.debug("Could not find 'Show Comments' button")

    // No show button but a comments section exists: poll until comments load
    const checkInterval = setInterval(() => {
      if (areCommentsLoaded()) {
        console.debug('Comments have been loaded')
        clearInterval(checkInterval)
        state.buttonAdded = false
        onCommentsLoaded()
      }
    }, 1000)

    // Stop checking after 30 seconds
    setTimeout(() => {
      clearInterval(checkInterval)
    }, 30000)
  }
}
