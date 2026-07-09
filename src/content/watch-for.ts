// Fire onFound exactly once, as soon as check() returns true. Checks
// immediately, otherwise waits for DOM node additions/removals. Returns a
// cancel function that stops the watcher.
export function watchFor(check: () => boolean, onFound: () => void): () => void {
  if (check()) {
    onFound()
    return () => {}
  }

  const observer = new MutationObserver(() => {
    if (check()) {
      observer.disconnect()
      onFound()
    }
  })

  observer.observe(document.documentElement, { childList: true, subtree: true })

  return () => observer.disconnect()
}
