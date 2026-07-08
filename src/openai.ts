export interface SummaryRequest {
  apiKey: string
  model: string
  system: string
  user: string
  temperature: number
  maxTokens: number
}

/** Reasoning models reject `temperature` and burn output tokens on thinking. */
export function isReasoningModel(model: string): boolean {
  return /^(o\d|gpt-5)/.test(model)
}

export async function requestSummary(req: SummaryRequest): Promise<string> {
  const reasoning = isReasoningModel(req.model)
  const body: Record<string, unknown> = {
    model: req.model,
    instructions: req.system,
    input: req.user,
    // Reasoning models spend output tokens on thinking before answering.
    max_output_tokens: reasoning ? req.maxTokens * 3 : req.maxTokens,
  }
  if (!reasoning) body.temperature = req.temperature
  return send(req.apiKey, body)
}

async function send(apiKey: string, body: Record<string, unknown>): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok) {
    const message: string = data?.error?.message ?? 'Unknown API error'
    // Self-heal: some models reject temperature; drop it and retry once.
    if (
      /unsupported parameter/i.test(message) &&
      /temperature/i.test(message) &&
      'temperature' in body
    ) {
      const { temperature: _drop, ...rest } = body
      return send(apiKey, rest)
    }
    throw new Error(`API request failed: ${message}`)
  }
  return extractText(data)
}

interface ResponsesOutput {
  status?: string
  incomplete_details?: { reason?: string }
  output_text?: string
  output?: Array<{ type?: string; content?: Array<{ text?: unknown }> }>
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
