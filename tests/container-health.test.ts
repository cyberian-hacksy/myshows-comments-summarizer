import { beforeEach, describe, expect, test, vi } from 'vitest'
import { healContainer, isContainerHealthy, releaseOrRemove } from '../src/content/button-manager'
import { cleanupExistingElements } from '../src/content/dom-utils'
import { state } from '../src/content/state'

beforeEach(() => {
  document.body.innerHTML = ''
  state.buttonAdded = false
  state.isAddingButton = false
})

function ourContainer(): string {
  return `
    <div id="comment-summarizer-container" data-comment-summarizer="true" style="padding-left: 20px;">
      <div><button id="summarize-button">Summarize</button></div>
    </div>`
}

// What the container looks like after Vue hydration adopts our node: same id
// and attributes, but the site's own content inside instead of our UI.
function hijackedContainer(): string {
  return `
    <div id="comment-summarizer-container" data-comment-summarizer="true" style="padding-left: 20px;">
      <div class="Episode-commentsHeader"><h3>Комментарии</h3></div>
    </div>`
}

describe('isContainerHealthy', () => {
  test('healthy when our UI is present right before #comments', () => {
    document.body.innerHTML = ourContainer() + '<div id="comments"></div>'
    expect(isContainerHealthy()).toBe(true)
  })

  test('unhealthy when the container is missing', () => {
    document.body.innerHTML = '<div id="comments"></div>'
    expect(isContainerHealthy()).toBe(false)
  })

  test('unhealthy when the container was hijacked by the site', () => {
    document.body.innerHTML = hijackedContainer() + '<div id="comments"></div>'
    expect(isContainerHealthy()).toBe(false)
  })

  test('unhealthy when the container lost its place next to #comments', () => {
    document.body.innerHTML = ourContainer() + '<div class="ad"></div><div id="comments"></div>'
    expect(isContainerHealthy()).toBe(false)
  })
})

describe('releaseOrRemove', () => {
  test('removes a container that holds our own UI', () => {
    document.body.innerHTML = ourContainer()
    releaseOrRemove(document.getElementById('comment-summarizer-container')!)
    expect(document.getElementById('comment-summarizer-container')).toBeNull()
    expect(document.querySelector('.Episode-commentsHeader')).toBeNull()
  })

  test('keeps site content but strips our markers from a hijacked container', () => {
    document.body.innerHTML = hijackedContainer()
    const el = document.getElementById('comment-summarizer-container')!

    releaseOrRemove(el)

    // Site content must survive
    expect(document.querySelector('.Episode-commentsHeader')).toBeTruthy()
    // But nothing identifies it as ours anymore, and our styling is gone
    expect(document.getElementById('comment-summarizer-container')).toBeNull()
    expect(el.hasAttribute('data-comment-summarizer')).toBe(false)
    expect(el.getAttribute('style')).toBeNull()
  })
})

describe('healContainer', () => {
  test('does nothing while the container is healthy', () => {
    document.body.innerHTML = ourContainer() + '<div id="comments"></div>'
    state.buttonAdded = true
    const tryAdd = vi.fn()

    healContainer(tryAdd)

    expect(tryAdd).not.toHaveBeenCalled()
  })

  test('rebuilds when the container went missing', () => {
    document.body.innerHTML = '<div id="comments"></div>'
    state.buttonAdded = true
    const tryAdd = vi.fn()

    healContainer(tryAdd)

    expect(state.buttonAdded).toBe(false)
    expect(tryAdd).toHaveBeenCalledTimes(1)
  })

  test('releases a hijacked container before rebuilding', () => {
    document.body.innerHTML = hijackedContainer() + '<div id="comments"></div>'
    state.buttonAdded = true
    const tryAdd = vi.fn()

    healContainer(tryAdd)

    // Site content kept, our id freed for the fresh insert
    expect(document.querySelector('.Episode-commentsHeader')).toBeTruthy()
    expect(document.getElementById('comment-summarizer-container')).toBeNull()
    expect(tryAdd).toHaveBeenCalledTimes(1)
  })

  test('does nothing when the button was never added', () => {
    document.body.innerHTML = '<div id="comments"></div>'
    const tryAdd = vi.fn()

    healContainer(tryAdd)

    expect(tryAdd).not.toHaveBeenCalled()
  })
})

describe('cleanupExistingElements', () => {
  test('removes leftover containers holding our UI', () => {
    document.body.innerHTML = ourContainer()
    cleanupExistingElements()
    expect(document.getElementById('comment-summarizer-container')).toBeNull()
  })

  test('releases hijacked containers instead of deleting site content', () => {
    document.body.innerHTML = hijackedContainer()
    cleanupExistingElements()
    expect(document.querySelector('.Episode-commentsHeader')).toBeTruthy()
    expect(document.getElementById('comment-summarizer-container')).toBeNull()
  })
})
