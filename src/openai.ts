import type { TokenUsage } from './types'

export interface SummaryRequest {
  apiKey: string
  model: string
  system: string
  user: string
  temperature: number
  maxTokens: number
  /** When provided, the response is streamed; called with the full text so far on each chunk. */
  onDelta?: (text: string) => void
}

export interface SummaryResult {
  text: string
  usage?: TokenUsage
}

/** Reasoning models reject `temperature` and burn output tokens on thinking. */
export function isReasoningModel(model: string): boolean {
  return /^(o\d|gpt-5)/.test(model)
}

export async function requestSummary(req: SummaryRequest): Promise<SummaryResult> {
  const reasoning = isReasoningModel(req.model)
  const body: Record<string, unknown> = {
    model: req.model,
    instructions: req.system,
    input: req.user,
    // Reasoning models spend output tokens on thinking before answering.
    max_output_tokens: reasoning ? req.maxTokens * 3 : req.maxTokens,
  }
  if (!reasoning) body.temperature = req.temperature
  if (req.onDelta) body.stream = true
  return send(req.apiKey, body, req.onDelta)
}

async function send(
  apiKey: string,
  body: Record<string, unknown>,
  onDelta?: (text: string) => void,
): Promise<SummaryResult> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    // Error responses are plain JSON even when a stream was requested.
    const data = await response.json()
    const error = data?.error as { message?: string; param?: string } | undefined
    const message = error?.message ?? 'Unknown API error'
    // Self-heal: some models reject temperature; drop it and retry once.
    if (
      /unsupported parameter/i.test(message) &&
      /temperature/i.test(message) &&
      'temperature' in body
    ) {
      const { temperature: _drop, ...rest } = body
      return send(apiKey, rest, onDelta)
    }
    // Self-heal: some account/model combinations may not stream (e.g. an
    // unverified org with gpt-5/o3); retry once without streaming.
    if ('stream' in body && (error?.param === 'stream' || /stream/i.test(message))) {
      const { stream: _drop, ...rest } = body
      return send(apiKey, rest)
    }
    throw new Error(`API request failed: ${message}`)
  }
  if (body.stream && onDelta && response.body) {
    return readStream(response.body, onDelta)
  }
  const data = await response.json()
  return { text: extractText(data), usage: extractUsage(data) }
}

interface StreamEvent {
  type?: string
  delta?: string
  message?: string
  response?: ResponsesOutput & { error?: { message?: string } }
}

/** Read a Responses API SSE stream, reporting accumulated text on each delta. */
async function readStream(
  stream: ReadableStream<Uint8Array>,
  onDelta: (text: string) => void,
): Promise<SummaryResult> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let final: StreamEvent['response']

  const handleEvent = (raw: string) => {
    const data = raw
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n')
    if (!data || data === '[DONE]') return
    let event: StreamEvent
    try {
      event = JSON.parse(data)
    } catch {
      return
    }
    if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
      text += event.delta
      onDelta(text)
    } else if (event.type === 'error') {
      throw new Error(`API request failed: ${event.message ?? 'Unknown API error'}`)
    } else if (
      event.type === 'response.completed' ||
      event.type === 'response.incomplete' ||
      event.type === 'response.failed'
    ) {
      final = event.response
    }
  }

  try {
    // SSE events are separated by blank lines; chunks may split events anywhere.
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let boundary: number
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        handleEvent(buffer.slice(0, boundary))
        buffer = buffer.slice(boundary + 2)
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (!final) throw new Error('Unexpected API response structure')
  if (final.status === 'failed') {
    throw new Error(`API request failed: ${final.error?.message ?? 'Unknown API error'}`)
  }
  const streamed = text.trim()
  if (streamed) return { text: streamed, usage: extractUsage(final) }
  return { text: extractText(final), usage: extractUsage(final) }
}

interface ResponsesOutput {
  status?: string
  incomplete_details?: { reason?: string }
  output_text?: string
  output?: Array<{ type?: string; content?: Array<{ text?: unknown }> }>
  usage?: {
    input_tokens?: number
    input_tokens_details?: { cached_tokens?: number }
    output_tokens?: number
    output_tokens_details?: { reasoning_tokens?: number }
  }
}

function extractUsage(data: ResponsesOutput): TokenUsage | undefined {
  const usage = data?.usage
  if (typeof usage?.input_tokens !== 'number' || typeof usage?.output_tokens !== 'number') {
    return undefined
  }
  return {
    inputTokens: usage.input_tokens,
    cachedInputTokens: usage.input_tokens_details?.cached_tokens ?? 0,
    outputTokens: usage.output_tokens,
    reasoningTokens: usage.output_tokens_details?.reasoning_tokens ?? 0,
  }
}

function extractText(data: ResponsesOutput): string {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim()
  }
  const texts: string[] = []
  for (const item of data?.output ?? []) {
    if (item?.type !== 'message') continue
    for (const part of item.content ?? []) {
      if (typeof part?.text === 'string') texts.push(part.text)
    }
  }
  if (texts.length) return texts.join('').trim()

  if (data?.status === 'incomplete' && data?.incomplete_details?.reason === 'max_output_tokens') {
    throw new Error(
      'The model ran out of tokens before finishing. Increase "Max tokens" in the extension options and try again.',
    )
  }
  if (typeof data?.status === 'string' && data.status !== 'completed') {
    throw new Error(`The API returned status "${data.status}". Please try again.`)
  }
  throw new Error('Unexpected API response structure')
}

const NON_CHAT =
  /(audio|realtime|search|transcribe|tts|image|embed|moderation|whisper|dall-e|instruct|davinci|babbage|chatgpt|codex|computer-use|deep-research)/
const DATED_SNAPSHOT = /-\d{4}(-\d{2}){0,2}$/

export function filterChatModels(ids: string[]): string[] {
  return ids
    .filter((id) => /^(gpt-\d|o\d)/.test(id))
    .filter((id) => !NON_CHAT.test(id))
    .filter((id) => !DATED_SNAPSHOT.test(id))
    .sort()
}

export async function fetchAvailableModels(apiKey: string): Promise<string[]> {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!response.ok) throw new Error(`Failed to fetch models: ${response.status}`)
  const data = await response.json()
  return filterChatModels((data.data ?? []).map((m: { id: string }) => m.id))
}
