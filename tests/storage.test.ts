import { beforeEach, describe, expect, test, vi } from 'vitest'
import { getPromptState, getSettings, savePromptState, saveSettings } from '../src/storage'
import { DEFAULT_SETTINGS } from '../src/types'

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
})

describe('getSettings', () => {
  test('returns defaults when storage is empty', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS)
  })

  test('reads the API key from local storage', async () => {
    localStore.openaiApiKey = 'sk-local'
    expect((await getSettings()).openaiApiKey).toBe('sk-local')
  })

  test('migrates a legacy key from sync to local', async () => {
    syncStore.openaiApiKey = 'sk-legacy'
    expect((await getSettings()).openaiApiKey).toBe('sk-legacy')
    expect(localStore.openaiApiKey).toBe('sk-legacy')
    expect(syncStore.openaiApiKey).toBeUndefined()
  })
})

describe('saveSettings', () => {
  test('splits the key into local and the rest into sync', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, openaiApiKey: 'sk-x', maxTokens: 1000 })
    expect(localStore.openaiApiKey).toBe('sk-x')
    expect(syncStore.openaiApiKey).toBeUndefined()
    expect(syncStore.maxTokens).toBe(1000)
  })
})

describe('prompt state', () => {
  test('returns empty overrides and customs by default', async () => {
    expect(await getPromptState()).toEqual({ overrides: {}, customs: [], systemPrompt: null })
  })

  test('round-trips overrides, customs and system prompt', async () => {
    const state = {
      overrides: { default: { name: 'Renamed' } },
      customs: [{ id: 'c1', name: 'Custom', builtin: false, template: 't {comments}' }],
      systemPrompt: 'You are terse.',
    }
    await savePromptState(state)
    expect(await getPromptState()).toEqual(state)
  })
})
