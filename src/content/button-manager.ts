import { state } from './state'

const OUR_UI_SELECTOR = '#summarize-button, #open-api-settings'

function containsOurUi(container: Element): boolean {
  return !!container.querySelector(OUR_UI_SELECTOR)
}

// Remove a container that is genuinely ours. A container hijacked by the
// site's framework (SSR hydration adopting our node) holds site content
// instead — deleting it would delete site UI, so strip our markers and
// styling and leave the content in place.
export function releaseOrRemove(container: Element): void {
  if (containsOurUi(container)) {
    container.remove()
  } else {
    console.debug('Container was taken over by the site, releasing it')
    container.removeAttribute('id')
    container.removeAttribute('data-comment-summarizer')
    container.removeAttribute('style')
  }
}

// Our container is healthy when it is the only one, still holds our UI, and
// still sits directly before the comments section.
export function isContainerHealthy(): boolean {
  const containers = document.querySelectorAll('#comment-summarizer-container')
  if (containers.length !== 1) return false
  const container = containers[0]!
  return containsOurUi(container) && container.nextElementSibling?.id === 'comments'
}

// Periodic self-heal: if our container went missing, got hijacked, or lost
// its place next to #comments, clear it out and rebuild.
export function healContainer(tryAddButton: () => void): void {
  if (!state.buttonAdded || isContainerHealthy()) return

  console.debug('Container missing or broken, rebuilding')
  document.querySelectorAll('#comment-summarizer-container').forEach(releaseOrRemove)
  state.buttonAdded = false
  tryAddButton()
}
