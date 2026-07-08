import type { PromptDefinition, PromptOverride, Settings } from './types'
import { DEFAULT_SETTINGS } from './types'

export interface PromptState {
  overrides: Record<string, PromptOverride>
  customs: PromptDefinition[]
  /** null means "use DEFAULT_SYSTEM_PROMPT" */
  systemPrompt: string | null
}

export async function getSettings(): Promise<Settings> {
  const { openaiApiKey: _ignored, ...syncDefaults } = DEFAULT_SETTINGS
  const [sync, local] = await Promise.all([
    chrome.storage.sync.get({ ...syncDefaults, openaiApiKey: '' }),
    chrome.storage.local.get({ openaiApiKey: '' }),
  ])
  let apiKey = local.openaiApiKey as string
  // One-time migration: the key used to live in sync storage.
  if (!apiKey && sync.openaiApiKey) {
    apiKey = sync.openaiApiKey as string
    await chrome.storage.local.set({ openaiApiKey: apiKey })
    await chrome.storage.sync.remove('openaiApiKey')
  }
  const { openaiApiKey: _sync, ...rest } = sync
  return { ...(rest as Omit<Settings, 'openaiApiKey'>), openaiApiKey: apiKey }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const { openaiApiKey, ...rest } = settings
  await Promise.all([
    chrome.storage.local.set({ openaiApiKey }),
    chrome.storage.sync.set(rest),
  ])
}

export async function getPromptState(): Promise<PromptState> {
  const items = await chrome.storage.sync.get({
    promptOverrides: {},
    customPrompts: [],
    systemPrompt: null,
  })
  return {
    overrides: items.promptOverrides as Record<string, PromptOverride>,
    customs: items.customPrompts as PromptDefinition[],
    systemPrompt: items.systemPrompt as string | null,
  }
}

export async function savePromptState(state: PromptState): Promise<void> {
  await chrome.storage.sync.set({
    promptOverrides: state.overrides,
    customPrompts: state.customs,
    systemPrompt: state.systemPrompt,
  })
}
