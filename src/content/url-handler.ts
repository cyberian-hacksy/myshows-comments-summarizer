import { state } from './state'

// Detect SPA navigation (URL changes without a page load) and re-run setup.
export function initURLChangeDetection(onUrlChange: () => void): void {
  let lastUrl = location.href
  let urlChangeTimeout: number | undefined

  new MutationObserver(() => {
    const currentUrl = location.href
    if (currentUrl !== lastUrl) {
      console.debug(`URL changed from ${lastUrl} to ${currentUrl}`)
      lastUrl = currentUrl

      if (urlChangeTimeout) {
        clearTimeout(urlChangeTimeout)
      }

      // Reset state
      state.buttonAdded = false

      // Debounce the URL change handling
      urlChangeTimeout = window.setTimeout(() => {
        console.debug('Processing URL change after debounce')
        onUrlChange()
      }, 500) // Wait 500ms for multiple rapid changes
    }
  }).observe(document, { subtree: true, childList: true })
}
