import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  computeCost,
  estimateOutputCost,
  FALLBACK_PRICING,
  formatCost,
  loadPricing,
  modelLabel,
  parseOpenRouterPricing,
  priceLabel,
} from '../src/pricing'

describe('parseOpenRouterPricing', () => {
  test('keeps openai models, strips the prefix, converts per-token to per-1M', () => {
    const map = parseOpenRouterPricing({
      data: [
        {
          id: 'openai/gpt-5',
          pricing: { prompt: '0.00000125', completion: '0.00001', input_cache_read: '0.000000125' },
        },
        { id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } },
        { id: 'anthropic/claude-3', pricing: { prompt: '0.000003', completion: '0.000015' } },
      ],
    })
    expect(map).toEqual({
      'gpt-5': { input: 1.25, output: 10, cachedInput: 0.125 },
      'gpt-4o': { input: 2.5, output: 10 },
    })
  })

  test('converts without float dust', () => {
    const map = parseOpenRouterPricing({
      data: [{ id: 'openai/gpt-4.1-mini', pricing: { prompt: '0.0000004', completion: '0.0000016' } }],
    })
    expect(map['gpt-4.1-mini']).toEqual({ input: 0.4, output: 1.6 })
  })

  test('skips variant ids, zero-priced and malformed entries', () => {
    const map = parseOpenRouterPricing({
      data: [
        { id: 'openai/gpt-4o:extended', pricing: { prompt: '0.000006', completion: '0.000018' } },
        { id: 'openai/gpt-oss-20b', pricing: { prompt: '0', completion: '0' } },
        { id: 'openai/broken', pricing: {} },
        { id: 'openai/no-pricing' },
      ],
    })
    expect(map).toEqual({})
  })

  test('returns an empty map on unexpected shapes', () => {
    expect(parseOpenRouterPricing({})).toEqual({})
    expect(parseOpenRouterPricing(null)).toEqual({})
  })
})

describe('modelLabel', () => {
  test('appends input/output prices when known', () => {
    expect(modelLabel('gpt-5', { input: 1.25, output: 10 })).toBe('gpt-5 — $1.25/$10')
    expect(modelLabel('gpt-4o', { input: 2.5, output: 10 })).toBe('gpt-4o — $2.50/$10')
    expect(modelLabel('gpt-4.1-mini', { input: 0.4, output: 1.6 })).toBe(
      'gpt-4.1-mini — $0.40/$1.60',
    )
  })

  test('returns the bare id when pricing is unknown', () => {
    expect(modelLabel('gpt-6-preview', undefined)).toBe('gpt-6-preview')
  })
})

describe('estimateOutputCost', () => {
  test('multiplies max tokens by the output price', () => {
    expect(estimateOutputCost({ input: 2.5, output: 10 }, 600, 'gpt-4o')).toBeCloseTo(0.006, 10)
  })

  test('triples the budget for reasoning models, matching requestSummary', () => {
    expect(estimateOutputCost({ input: 1.25, output: 10 }, 600, 'gpt-5')).toBeCloseTo(0.018, 10)
    expect(estimateOutputCost({ input: 1.1, output: 4.4 }, 1000, 'o4-mini')).toBeCloseTo(
      0.0132,
      10,
    )
  })
})

describe('computeCost', () => {
  test('bills cached input tokens at the cached rate', () => {
    const cost = computeCost(
      { input: 1.25, output: 10, cachedInput: 0.125 },
      { inputTokens: 10_000, cachedInputTokens: 4_000, outputTokens: 500 },
    )
    // 6000 × $1.25/1M + 4000 × $0.125/1M + 500 × $10/1M
    expect(cost).toBeCloseTo(0.013, 10)
  })

  test('bills cached tokens at the full rate when no cached price is known', () => {
    const cost = computeCost(
      { input: 2.5, output: 10 },
      { inputTokens: 1_000, cachedInputTokens: 400, outputTokens: 100 },
    )
    expect(cost).toBeCloseTo(0.0035, 10)
  })
})

describe('formatCost', () => {
  test('uses two decimals from ten cents up', () => {
    expect(formatCost(0.12)).toBe('$0.12')
    expect(formatCost(1.5)).toBe('$1.50')
  })

  test('uses two significant figures below ten cents', () => {
    expect(formatCost(0.013)).toBe('$0.013')
    expect(formatCost(0.0042)).toBe('$0.0042')
    expect(formatCost(0.000087)).toBe('$0.000087')
    expect(formatCost(0.0625)).toBe('$0.063')
    expect(formatCost(0.006)).toBe('$0.006')
  })

  test('handles zero', () => {
    expect(formatCost(0)).toBe('$0.00')
  })
})

describe('loadPricing', () => {
  let localStore: Record<string, unknown>

  beforeEach(() => {
    localStore = {}
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn(async (defaults: Record<string, unknown>) => ({
            ...defaults,
            ...localStore,
          })),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(localStore, items)
          }),
        },
      },
    })
  })

  const DAY = 24 * 60 * 60 * 1000
  const live = { 'gpt-6': { input: 3, output: 12 } }

  test('no cache: fetches, stores, and merges over the fallback table', async () => {
    const fetcher = vi.fn(async () => live)
    const prices = await loadPricing({ fetcher, now: 1000 })
    expect(prices['gpt-6']).toEqual({ input: 3, output: 12 })
    expect(prices['gpt-4o']).toEqual(FALLBACK_PRICING['gpt-4o'])
    expect(localStore.pricingCache).toEqual({ prices: live, fetchedAt: 1000 })
  })

  test('fresh cache: no fetch', async () => {
    localStore.pricingCache = { prices: live, fetchedAt: 1000 }
    const fetcher = vi.fn()
    const prices = await loadPricing({ fetcher, now: 1000 + 60_000 })
    expect(prices['gpt-6']).toEqual({ input: 3, output: 12 })
    expect(fetcher).not.toHaveBeenCalled()
  })

  test('stale cache: refetches and overwrites', async () => {
    localStore.pricingCache = { prices: { 'gpt-6': { input: 9, output: 99 } }, fetchedAt: 0 }
    const fetcher = vi.fn(async () => live)
    const prices = await loadPricing({ fetcher, now: DAY + 1 })
    expect(prices['gpt-6']).toEqual({ input: 3, output: 12 })
    expect(localStore.pricingCache).toEqual({ prices: live, fetchedAt: DAY + 1 })
  })

  test('fetch failure: falls back to stale cache merged over the fallback table', async () => {
    localStore.pricingCache = { prices: live, fetchedAt: 0 }
    const prices = await loadPricing({
      fetcher: async () => {
        throw new Error('boom')
      },
      now: DAY + 1,
    })
    expect(prices['gpt-6']).toEqual({ input: 3, output: 12 })
    expect(prices['gpt-4o']).toEqual(FALLBACK_PRICING['gpt-4o'])
  })

  test('empty fetch result is not cached', async () => {
    const fetcher = vi.fn(async () => ({}))
    const prices = await loadPricing({ fetcher, now: 1000 })
    expect(prices).toEqual(FALLBACK_PRICING)
    expect(localStore.pricingCache).toBeUndefined()
  })
})

describe('priceLabel', () => {
  test('formats input/output prices per 1M tokens', () => {
    expect(priceLabel({ input: 1.25, output: 10 })).toBe('$1.25 / $10')
  })

  test('returns undefined without pricing', () => {
    expect(priceLabel(undefined)).toBeUndefined()
  })
})
