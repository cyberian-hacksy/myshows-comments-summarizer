// Model list handling: live list from the OpenAI API, cached with fallbacks.

export const DEFAULT_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'o4-mini',
]

/** Curated blurbs for models we know; unknown ids simply get no description. */
export const MODEL_DESCRIPTIONS: Record<string, string> = {
  'gpt-4o': 'Fast, intelligent, flexible GPT model',
  'gpt-4.1': 'Smartest model for complex tasks',
  'gpt-5': 'Most advanced model for complex tasks',
  'gpt-4o-mini': 'Fast, affordable small model for focused tasks',
  'gpt-4.1-mini': 'Affordable model balancing speed and intelligence',
  'gpt-4.1-nano': 'Fastest, most cost-effective model for low-latency tasks',
  'gpt-5-mini': 'Compact GPT-5 model for fast, affordable tasks',
  'gpt-5-nano': 'Smallest GPT-5 model for ultra-low latency tasks',
  'o4-mini': 'Faster, more affordable reasoning model',
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export interface ModelCache {
  ids: string[]
  fetchedAt: number
}

export async function readModelCache(): Promise<ModelCache | null> {
  const { modelCache } = (await chrome.storage.local.get({ modelCache: null })) as {
    modelCache: ModelCache | null
  }
  return modelCache
}

export function isCacheFresh(cache: ModelCache | null, now: number): boolean {
  return !!cache && now - cache.fetchedAt < CACHE_TTL_MS
}

export async function writeModelCache(ids: string[], now: number): Promise<void> {
  await chrome.storage.local.set({ modelCache: { ids, fetchedAt: now } })
}

export type ModelListOutcome = 'live' | 'cache' | 'default' | 'error'

export interface LoadModelListOptions {
  apiKey: string
  fetcher: (apiKey: string) => Promise<string[]>
  /** Bypass a fresh cache and fetch anyway. */
  force?: boolean
  now?: number
  /**
   * Called with the best list available at each phase: first synchronously
   * from cache/defaults (`fetching` true when a live fetch will follow),
   * then again with the live list once it arrives.
   */
  onUpdate: (ids: string[], fetching: boolean) => void
}

/**
 * Two-phase model list load: paint instantly from cache (or the default
 * list), then — when a key is present and the cache is missing, stale, or
 * bypassed — fetch the live list, persist it, and emit it.
 */
export async function loadModelList(options: LoadModelListOptions): Promise<ModelListOutcome> {
  const { apiKey, fetcher, force = false, now = Date.now(), onUpdate } = options

  const cache = await readModelCache()
  const cachedOutcome: ModelListOutcome = cache ? 'cache' : 'default'
  const willFetch = !!apiKey && (force || !isCacheFresh(cache, now))

  onUpdate(cache?.ids ?? DEFAULT_MODELS, willFetch)
  if (!willFetch) return cachedOutcome

  try {
    const ids = await fetcher(apiKey)
    if (!ids.length) return cachedOutcome
    await writeModelCache(ids, now)
    onUpdate(ids, false)
    return 'live'
  } catch (error) {
    console.warn('Model list fetch failed, falling back', error)
    return 'error'
  }
}
