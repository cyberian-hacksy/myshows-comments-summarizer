import { afterEach, describe, expect, test, vi } from 'vitest'
import { fetchAvailableModels, filterChatModels, requestSummary } from '../src/openai'

afterEach(() => vi.unstubAllGlobals())

function stubFetch(response: unknown, ok = true) {
  const mock = vi.fn(async () => ({ ok, json: async () => response }))
  vi.stubGlobal('fetch', mock)
  return mock
}

describe('requestSummary', () => {
  const base = {
    apiKey: 'sk-test',
    system: 'sys',
    user: 'usr',
    temperature: 0.7,
    maxTokens: 600,
  }

  test('calls the Responses API with temperature for non-reasoning models', async () => {
    const mock = stubFetch({ status: 'completed', output_text: 'summary' })
    const result = await requestSummary({ ...base, model: 'gpt-4o' })
    expect(result.text).toBe('summary')
    const [url, options] = mock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.openai.com/v1/responses')
    expect((options.headers as Record<string, string>).Authorization).toBe('Bearer sk-test')
    const body = JSON.parse(options.body as string)
    expect(body).toMatchObject({
      model: 'gpt-4o',
      instructions: 'sys',
      input: 'usr',
      temperature: 0.7,
      max_output_tokens: 600,
    })
  })

  test('omits temperature and triples the token budget for reasoning models', async () => {
    const mock = stubFetch({ status: 'completed', output_text: 'summary' })
    await requestSummary({ ...base, model: 'gpt-5-mini' })
    const body = JSON.parse(
      (mock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    )
    expect(body).not.toHaveProperty('temperature')
    expect(body.max_output_tokens).toBe(1800)
  })

  test('retries without temperature when the API rejects it', async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: "Unsupported parameter: 'temperature'" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'completed', output_text: 'ok' }),
      })
    vi.stubGlobal('fetch', mock)
    expect((await requestSummary({ ...base, model: 'gpt-4o' })).text).toBe('ok')
    expect(mock).toHaveBeenCalledTimes(2)
    const retryBody = JSON.parse(
      (mock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string,
    )
    expect(retryBody).not.toHaveProperty('temperature')
  })

  test('surfaces other API errors', async () => {
    stubFetch({ error: { message: 'Incorrect API key provided' } }, false)
    await expect(requestSummary({ ...base, model: 'gpt-4o' })).rejects.toThrow(
      /API request failed: Incorrect API key/,
    )
  })

  test('extracts text from output items when output_text is absent', async () => {
    stubFetch({
      status: 'completed',
      output: [
        { type: 'reasoning', content: [] },
        { type: 'message', content: [{ type: 'output_text', text: 'from items' }] },
      ],
    })
    expect((await requestSummary({ ...base, model: 'gpt-5' })).text).toBe('from items')
  })

  test('normalizes token usage from the response', async () => {
    stubFetch({
      status: 'completed',
      output_text: 'summary',
      usage: {
        input_tokens: 1200,
        input_tokens_details: { cached_tokens: 800 },
        output_tokens: 350,
        output_tokens_details: { reasoning_tokens: 100 },
        total_tokens: 1550,
      },
    })
    const result = await requestSummary({ ...base, model: 'gpt-5' })
    expect(result.usage).toEqual({
      inputTokens: 1200,
      cachedInputTokens: 800,
      outputTokens: 350,
      reasoningTokens: 100,
    })
  })

  test('returns undefined usage when the response has none', async () => {
    stubFetch({ status: 'completed', output_text: 'summary' })
    const result = await requestSummary({ ...base, model: 'gpt-4o' })
    expect(result.usage).toBeUndefined()
  })

  test('explains truncation when the response is incomplete', async () => {
    stubFetch({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } })
    await expect(requestSummary({ ...base, model: 'gpt-5' })).rejects.toThrow(/max tokens/i)
  })

  test('rejects on an unrecognized response shape', async () => {
    stubFetch({ unexpected: true })
    await expect(requestSummary({ ...base, model: 'gpt-4o' })).rejects.toThrow(
      /Unexpected API response structure/,
    )
  })
})

describe('requestSummary (streaming)', () => {
  const base = {
    apiKey: 'sk-test',
    system: 'sys',
    user: 'usr',
    temperature: 0.7,
    maxTokens: 600,
  }

  function sseEvent(type: string, data: Record<string, unknown>): string {
    return `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`
  }

  function stubStreamFetch(...chunks: string[]) {
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
        controller.close()
      },
    })
    const mock = vi.fn(async () => ({ ok: true, body }))
    vi.stubGlobal('fetch', mock)
    return mock
  }

  test('requests a stream and reports accumulated text on each delta', async () => {
    const usage = { input_tokens: 100, output_tokens: 20 }
    const mock = stubStreamFetch(
      sseEvent('response.output_text.delta', { delta: 'Hel' }),
      sseEvent('response.output_text.delta', { delta: 'lo' }),
      sseEvent('response.completed', {
        response: { status: 'completed', output_text: 'Hello', usage },
      }),
    )
    const onDelta = vi.fn()
    const result = await requestSummary({ ...base, model: 'gpt-4o', onDelta })
    const body = JSON.parse(
      (mock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    )
    expect(body.stream).toBe(true)
    expect(onDelta.mock.calls.map(([text]) => text)).toEqual(['Hel', 'Hello'])
    expect(result.text).toBe('Hello')
    expect(result.usage).toMatchObject({ inputTokens: 100, outputTokens: 20 })
  })

  test('handles events split across network chunks', async () => {
    const event = sseEvent('response.output_text.delta', { delta: 'whole' })
    stubStreamFetch(
      event.slice(0, 25),
      event.slice(25) + sseEvent('response.completed', { response: { status: 'completed' } }),
    )
    const onDelta = vi.fn()
    const result = await requestSummary({ ...base, model: 'gpt-4o', onDelta })
    expect(onDelta).toHaveBeenCalledWith('whole')
    expect(result.text).toBe('whole')
  })

  test('falls back to a non-streaming request when the API rejects streaming', async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: {
            message: 'Your organization must be verified to stream this model.',
            param: 'stream',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'completed', output_text: 'fallback' }),
      })
    vi.stubGlobal('fetch', mock)
    const onDelta = vi.fn()
    const result = await requestSummary({ ...base, model: 'gpt-5', onDelta })
    expect(result.text).toBe('fallback')
    expect(mock).toHaveBeenCalledTimes(2)
    const retryBody = JSON.parse(
      (mock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string,
    )
    expect(retryBody).not.toHaveProperty('stream')
  })

  test('explains truncation when a streamed response is incomplete with no text', async () => {
    stubStreamFetch(
      sseEvent('response.incomplete', {
        response: { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } },
      }),
    )
    await expect(requestSummary({ ...base, model: 'gpt-5', onDelta: vi.fn() })).rejects.toThrow(
      /max tokens/i,
    )
  })

  test('keeps partial text when a streamed response is cut off mid-answer', async () => {
    stubStreamFetch(
      sseEvent('response.output_text.delta', { delta: 'Partial summary' }),
      sseEvent('response.incomplete', {
        response: { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } },
      }),
    )
    const result = await requestSummary({ ...base, model: 'gpt-5', onDelta: vi.fn() })
    expect(result.text).toBe('Partial summary')
  })

  test('surfaces a mid-stream failure as an error', async () => {
    stubStreamFetch(
      sseEvent('response.failed', {
        response: { status: 'failed', error: { message: 'The model is overloaded' } },
      }),
    )
    await expect(requestSummary({ ...base, model: 'gpt-4o', onDelta: vi.fn() })).rejects.toThrow(
      /overloaded/,
    )
  })

  test('rejects when the stream ends without a terminal event', async () => {
    stubStreamFetch(sseEvent('response.output_text.delta', { delta: 'Hel' }))
    await expect(requestSummary({ ...base, model: 'gpt-4o', onDelta: vi.fn() })).rejects.toThrow(
      /Unexpected API response structure/,
    )
  })
})

describe('filterChatModels', () => {
  test('keeps chat families, drops other modalities and dated snapshots', () => {
    const ids = [
      'gpt-4o',
      'gpt-4o-2024-08-06',
      'gpt-4o-mini',
      'gpt-5',
      'o4-mini',
      'gpt-4o-audio-preview',
      'gpt-4o-realtime-preview',
      'whisper-1',
      'dall-e-3',
      'text-embedding-3-small',
      'omni-moderation-latest',
      'gpt-4o-transcribe',
      'gpt-4o-mini-tts',
      'chatgpt-4o-latest',
      'gpt-3.5-turbo-instruct',
      'davinci-002',
      'gpt-image-1',
      'codex-mini-latest',
      'gpt-4o-search-preview',
      'computer-use-preview',
      'o3-deep-research',
    ]
    expect(filterChatModels(ids)).toEqual(['gpt-4o', 'gpt-4o-mini', 'gpt-5', 'o4-mini'])
  })
})

describe('fetchAvailableModels', () => {
  test('fetches, filters and sorts the model list', async () => {
    stubFetch({ data: [{ id: 'gpt-5' }, { id: 'whisper-1' }, { id: 'gpt-4o' }] })
    expect(await fetchAvailableModels('sk-test')).toEqual(['gpt-4o', 'gpt-5'])
  })

  test('throws on an HTTP error', async () => {
    const mock = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }))
    vi.stubGlobal('fetch', mock)
    await expect(fetchAvailableModels('sk-bad')).rejects.toThrow(/401/)
  })
})
