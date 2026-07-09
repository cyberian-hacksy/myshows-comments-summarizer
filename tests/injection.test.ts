import { beforeEach, describe, expect, test, vi } from 'vitest'
import { state } from '../src/content/state'
import { armCommentsWatcher } from '../src/content/ui'
import { initURLChangeDetection } from '../src/content/url-handler'

function fakeArea(store: Record<string, unknown>) {
  return {
    get: vi.fn(async (defaults: Record<string, unknown>) => ({ ...defaults, ...store })),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(store, items)
    }),
    remove: vi.fn(async (key: string) => {
      delete store[key]
    }),
  }
}

let syncStore: Record<string, unknown>
let localStore: Record<string, unknown>

beforeEach(() => {
  syncStore = {}
  localStore = {}
  vi.stubGlobal('chrome', {
    storage: { sync: fakeArea(syncStore), local: fakeArea(localStore) },
  })

  document.body.innerHTML = ''
  document.querySelectorAll('style[data-comment-summarizer]').forEach((s) => s.remove())
  state.cancelWatch?.()
  state.cancelWatch = null
  state.buttonAdded = false
  state.isAddingButton = false
  if (state.buttonCheckInterval) {
    clearInterval(state.buttonCheckInterval)
    state.buttonCheckInterval = null
  }
  if (state.hydrationGraceTimer) {
    clearTimeout(state.hydrationGraceTimer)
    state.hydrationGraceTimer = null
  }
  // Most tests exercise steady-state behavior, after the one-time grace period
  state.hydrationGraceElapsed = true
})

const container = () => document.getElementById('comment-summarizer-container')

describe('armCommentsWatcher', () => {
  test('inserts the container right before #comments when comments are already rendered', async () => {
    localStore.openaiApiKey = 'sk-test'
    document.body.innerHTML =
      '<div id="comments"><div class="Comment__text">first!</div></div>'

    armCommentsWatcher()

    await vi.waitFor(() => expect(container()).toBeTruthy(), { timeout: 500 })
    expect(container()!.nextElementSibling?.id).toBe('comments')
    expect(container()!.querySelector('#summarize-button')).toBeTruthy()
  })

  test('shows the API-key setup prompt when no key is configured', async () => {
    document.body.innerHTML =
      '<div id="comments"><div class="Comment__text">first!</div></div>'

    armCommentsWatcher()

    await vi.waitFor(() => expect(container()).toBeTruthy(), { timeout: 500 })
    expect(container()!.querySelector('#open-api-settings')).toBeTruthy()
  })

  test('inserts the container as soon as #comments is added to the page', async () => {
    localStore.openaiApiKey = 'sk-test'

    armCommentsWatcher()
    await new Promise((r) => setTimeout(r, 20))
    expect(container()).toBeNull()

    document.body.innerHTML =
      '<div id="comments"><div class="Comment__text">late</div></div>'

    await vi.waitFor(() => expect(container()).toBeTruthy(), { timeout: 500 })
  })

  test('holds off until comments behind the Show-Comments button are loaded', async () => {
    localStore.openaiApiKey = 'sk-test'
    document.body.innerHTML =
      '<button class="Episode-commentsShow">Show comments</button><div id="comments"></div>'

    armCommentsWatcher()
    await new Promise((r) => setTimeout(r, 20))
    expect(container()).toBeNull()

    // Comments load (user clicked the site's button)
    document.querySelector('.Episode-commentsShow')!.remove()
    const comment = document.createElement('div')
    comment.className = 'Comment__text'
    document.getElementById('comments')!.appendChild(comment)

    await vi.waitFor(() => expect(container()).toBeTruthy(), { timeout: 500 })
    expect(container()!.querySelector('#summarize-button')).toBeTruthy()
  })

  test('re-arming replaces the previous watcher instead of stacking', async () => {
    localStore.openaiApiKey = 'sk-test'

    armCommentsWatcher()
    armCommentsWatcher()

    document.body.innerHTML =
      '<div id="comments"><div class="Comment__text">hi</div></div>'

    await vi.waitFor(() => expect(container()).toBeTruthy(), { timeout: 500 })
    expect(document.querySelectorAll('#comment-summarizer-container').length).toBe(1)
  })
})

describe('hydration grace period', () => {
  test('delays the first insertion so SSR hydration cannot hijack our container', async () => {
    vi.useFakeTimers()
    try {
      localStore.openaiApiKey = 'sk-test'
      state.hydrationGraceElapsed = false
      document.body.innerHTML =
        '<div id="comments"><div class="Comment__text">hi</div></div>'

      armCommentsWatcher()
      await vi.advanceTimersByTimeAsync(900)
      expect(container()).toBeNull()

      await vi.advanceTimersByTimeAsync(200)
      expect(container()).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  test('later insertions are immediate once the grace period elapsed', async () => {
    localStore.openaiApiKey = 'sk-test'
    document.body.innerHTML =
      '<div id="comments"><div class="Comment__text">hi</div></div>'

    armCommentsWatcher()

    await vi.waitFor(() => expect(container()).toBeTruthy(), { timeout: 500 })
  })
})

describe('initURLChangeDetection', () => {
  test('fires the callback promptly on SPA URL change, without a debounce delay', async () => {
    const onUrlChange = vi.fn()
    state.buttonAdded = true

    const disconnect = initURLChangeDetection(onUrlChange)
    try {
      history.pushState({}, '', '/view/episode/999999/')
      document.body.appendChild(document.createElement('p'))

      await vi.waitFor(() => expect(onUrlChange).toHaveBeenCalledTimes(1), { timeout: 200 })
      expect(state.buttonAdded).toBe(false)
    } finally {
      disconnect()
    }
  })
})
