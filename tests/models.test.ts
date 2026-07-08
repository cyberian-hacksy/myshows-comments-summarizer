import { beforeEach, describe, expect, test, vi } from 'vitest'
import { DEFAULT_MODELS, loadModelList } from '../src/models'

let localStore: Record<string, unknown>

beforeEach(() => {
  localStore = {}
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(async (defaults: Record<string, unknown>) => ({ ...defaults, ...localStore })),
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.assign(localStore, items)
        }),
      },
    },
  })
})

const DAY = 24 * 60 * 60 * 1000

describe('loadModelList', () => {
  test('no key: paints defaults once, never fetches', async () => {
    const fetcher = vi.fn()
    const updates: Array<[string[], boolean]> = []
    const outcome = await loadModelList({
      apiKey: '',
      fetcher,
      onUpdate: (ids, fetching) => updates.push([ids, fetching]),
    })
    expect(outcome).toBe('default')
    expect(updates).toEqual([[DEFAULT_MODELS, false]])
    expect(fetcher).not.toHaveBeenCalled()
  })

  test('key + no cache: paints defaults, then fetches, caches, and paints live', async () => {
    const fetcher = vi.fn(async () => ['gpt-6', 'gpt-6-mini'])
    const updates: Array<[string[], boolean]> = []
    const outcome = await loadModelList({
      apiKey: 'sk-x',
      fetcher,
      now: 1000,
      onUpdate: (ids, fetching) => updates.push([ids, fetching]),
    })
    expect(outcome).toBe('live')
    expect(updates).toEqual([
      [DEFAULT_MODELS, true],
      [['gpt-6', 'gpt-6-mini'], false],
    ])
    expect(localStore.modelCache).toEqual({ ids: ['gpt-6', 'gpt-6-mini'], fetchedAt: 1000 })
  })

  test('key + fresh cache: paints cache once, no fetch', async () => {
    localStore.modelCache = { ids: ['gpt-cached'], fetchedAt: 1000 }
    const fetcher = vi.fn()
    const updates: Array<[string[], boolean]> = []
    const outcome = await loadModelList({
      apiKey: 'sk-x',
      fetcher,
      now: 1000 + 60_000,
      onUpdate: (ids, fetching) => updates.push([ids, fetching]),
    })
    expect(outcome).toBe('cache')
    expect(updates).toEqual([[['gpt-cached'], false]])
    expect(fetcher).not.toHaveBeenCalled()
  })

  test('key + stale cache: paints cache, then refetches', async () => {
    localStore.modelCache = { ids: ['gpt-old'], fetchedAt: 0 }
    const fetcher = vi.fn(async () => ['gpt-new'])
    const updates: Array<[string[], boolean]> = []
    const outcome = await loadModelList({
      apiKey: 'sk-x',
      fetcher,
      now: DAY + 1,
      onUpdate: (ids, fetching) => updates.push([ids, fetching]),
    })
    expect(outcome).toBe('live')
    expect(updates).toEqual([
      [['gpt-old'], true],
      [['gpt-new'], false],
    ])
  })

  test('force bypasses a fresh cache', async () => {
    localStore.modelCache = { ids: ['gpt-cached'], fetchedAt: 1000 }
    const fetcher = vi.fn(async () => ['gpt-live'])
    const outcome = await loadModelList({
      apiKey: 'sk-x',
      fetcher,
      now: 2000,
      force: true,
      onUpdate: () => {},
    })
    expect(outcome).toBe('live')
    expect(fetcher).toHaveBeenCalledOnce()
  })

  test('fetch failure: reports error, keeps the stale-cache paint', async () => {
    localStore.modelCache = { ids: ['gpt-stale'], fetchedAt: 0 }
    const updates: Array<[string[], boolean]> = []
    const outcome = await loadModelList({
      apiKey: 'sk-x',
      fetcher: async () => {
        throw new Error('boom')
      },
      now: DAY + 1,
      onUpdate: (ids, fetching) => updates.push([ids, fetching]),
    })
    expect(outcome).toBe('error')
    expect(updates).toEqual([[['gpt-stale'], true]])
    expect((localStore.modelCache as { ids: string[] }).ids).toEqual(['gpt-stale'])
  })

  test('empty fetched list is ignored and not cached', async () => {
    const fetcher = vi.fn(async () => [])
    const updates: Array<[string[], boolean]> = []
    const outcome = await loadModelList({
      apiKey: 'sk-x',
      fetcher,
      now: 1000,
      onUpdate: (ids, fetching) => updates.push([ids, fetching]),
    })
    expect(outcome).toBe('default')
    expect(updates).toEqual([[DEFAULT_MODELS, true]])
    expect(localStore.modelCache).toBeUndefined()
  })
})
