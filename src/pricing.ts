// Model pricing: live prices from OpenRouter's public catalog, cached with a
// bundled fallback. OpenAI's own API exposes no pricing, so prices come from
// openrouter.ai, which lists OpenAI models at OpenAI's list prices.

import { isReasoningModel } from './openai'
import type { TokenUsage } from './types'

export interface ModelPricing {
  /** Dollars per 1M input tokens. */
  input: number
  /** Dollars per 1M output tokens. */
  output: number
  /** Dollars per 1M cached input tokens. */
  cachedInput?: number
}

export type PricingMap = Record<string, ModelPricing>

/** List prices for the default models, used offline and before the first fetch. */
export const FALLBACK_PRICING: PricingMap = {
  'gpt-4o': { input: 2.5, output: 10, cachedInput: 1.25 },
  'gpt-4o-mini': { input: 0.15, output: 0.6, cachedInput: 0.075 },
  'gpt-4.1': { input: 2, output: 8, cachedInput: 0.5 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6, cachedInput: 0.1 },
  'gpt-4.1-nano': { input: 0.1, output: 0.4, cachedInput: 0.025 },
  'gpt-5': { input: 1.25, output: 10, cachedInput: 0.125 },
  'gpt-5-mini': { input: 0.25, output: 2, cachedInput: 0.025 },
  'gpt-5-nano': { input: 0.05, output: 0.4, cachedInput: 0.005 },
  'o4-mini': { input: 1.1, output: 4.4, cachedInput: 0.275 },
}

/** Per-token price string → dollars per 1M tokens, rounded to kill float dust. */
function perMillion(perToken: unknown): number | null {
  const n = typeof perToken === 'string' ? parseFloat(perToken) : NaN
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 1e6 * 1e6) / 1e6
}

interface OpenRouterModel {
  id?: unknown
  pricing?: { prompt?: unknown; completion?: unknown; input_cache_read?: unknown }
}

export function parseOpenRouterPricing(data: unknown): PricingMap {
  const models = (data as { data?: OpenRouterModel[] } | null)?.data
  const map: PricingMap = {}
  if (!Array.isArray(models)) return map
  for (const m of models) {
    if (typeof m?.id !== 'string' || !m.id.startsWith('openai/')) continue
    const id = m.id.slice('openai/'.length)
    // ':free'/':extended' variants are OpenRouter routes, not OpenAI model ids
    if (id.includes(':')) continue
    const input = perMillion(m.pricing?.prompt)
    const output = perMillion(m.pricing?.completion)
    if (input === null || output === null) continue
    const cachedInput = perMillion(m.pricing?.input_cache_read)
    map[id] = cachedInput === null ? { input, output } : { input, output, cachedInput }
  }
  return map
}

export async function fetchPricing(): Promise<PricingMap> {
  const response = await fetch('https://openrouter.ai/api/v1/models')
  if (!response.ok) throw new Error(`Failed to fetch pricing: ${response.status}`)
  return parseOpenRouterPricing(await response.json())
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

interface PricingCache {
  prices: PricingMap
  fetchedAt: number
}

export interface LoadPricingOptions {
  fetcher?: () => Promise<PricingMap>
  now?: number
}

/**
 * Best-known pricing map: cached OpenRouter prices merged over the bundled
 * fallback, refreshed when older than 24h. Fetch failures keep the last
 * known prices instead of throwing.
 */
export async function loadPricing(options: LoadPricingOptions = {}): Promise<PricingMap> {
  const { fetcher = fetchPricing, now = Date.now() } = options
  const { pricingCache } = (await chrome.storage.local.get({ pricingCache: null })) as {
    pricingCache: PricingCache | null
  }
  let prices = pricingCache?.prices ?? {}
  if (!pricingCache || now - pricingCache.fetchedAt >= CACHE_TTL_MS) {
    try {
      const fetched = await fetcher()
      if (Object.keys(fetched).length) {
        await chrome.storage.local.set({ pricingCache: { prices: fetched, fetchedAt: now } })
        prices = fetched
      }
    } catch (error) {
      console.warn('Pricing fetch failed, using last known prices', error)
    }
  }
  return { ...FALLBACK_PRICING, ...prices }
}

/** "$1.25", "$0.40", "$10" — dollars per 1M tokens as shown in the model list. */
function perM(n: number): string {
  return `$${n.toFixed(2).replace(/\.00$/, '')}`
}

export function modelLabel(id: string, pricing?: ModelPricing): string {
  return pricing ? `${id} — ${perM(pricing.input)}/${perM(pricing.output)}` : id
}

/** "$1.25 / $10" — input/output prices per 1M tokens, for dropdown sublabels. */
export function priceLabel(pricing?: ModelPricing): string | undefined {
  return pricing ? `${perM(pricing.input)} / ${perM(pricing.output)}` : undefined
}

/** Worst-case output spend for one summary; mirrors requestSummary's token budget. */
export function estimateOutputCost(
  pricing: ModelPricing,
  maxTokens: number,
  model: string,
): number {
  const budget = isReasoningModel(model) ? maxTokens * 3 : maxTokens
  return (budget * pricing.output) / 1e6
}

export function computeCost(pricing: ModelPricing, usage: TokenUsage): number {
  const cached = usage.cachedInputTokens
  const fresh = usage.inputTokens - cached
  const cachedRate = pricing.cachedInput ?? pricing.input
  return (fresh * pricing.input + cached * cachedRate + usage.outputTokens * pricing.output) / 1e6
}

export function formatCost(dollars: number): string {
  if (dollars >= 0.1 || dollars === 0) return `$${dollars.toFixed(2)}`
  return `$${Number(dollars.toPrecision(2))}`
}
