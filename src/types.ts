export interface Comment {
  text: string
  rating: string
}

export interface PromptDefinition {
  id: string
  name: string
  builtin: boolean
  template: string // may contain {count}, {comments}, {language}
}

/** Partial edits applied on top of a built-in prompt. */
export interface PromptOverride {
  name?: string
  template?: string
}

/** Normalized token usage from a Responses API reply. */
export interface TokenUsage {
  inputTokens: number
  /** Subset of inputTokens billed at the discounted cached rate. */
  cachedInputTokens: number
  outputTokens: number
  /** Subset of outputTokens spent on reasoning (reasoning models only). */
  reasoningTokens?: number
}

export interface Settings {
  openaiApiKey: string
  selectedModel: string
  summaryLanguage: string
  temperature: number
  maxTokens: number
  selectedPromptId: string
}

export const DEFAULT_SETTINGS: Settings = {
  openaiApiKey: '',
  selectedModel: 'gpt-4o',
  summaryLanguage: 'english',
  temperature: 0.7,
  maxTokens: 600,
  selectedPromptId: 'default',
}
