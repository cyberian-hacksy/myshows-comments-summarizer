import { state } from './state'

// Detect SPA navigation (URL changes without a page load) and re-run setup.
// Returns a function that stops the detection.
export function initURLChangeDetection(onUrlChange: () => void): () => void {
  let lastUrl = location.href

  const observer = new MutationObserver(() => {
    const currentUrl = location.href
    if (currentUrl !== lastUrl) {
      console.debug(`URL changed from ${lastUrl} to ${currentUrl}`)
      lastUrl = currentUrl

      // Reset state and re-arm immediately; re-arming is idempotent, so
      // rapid successive URL changes need no debounce.
      state.buttonAdded = false
      onUrlChange()
    }
  })

  observer.observe(document, { subtree: true, childList: true })
  return () => observer.disconnect()
}
