import { beforeEach, describe, expect, it, vi } from 'vitest'
import { extractChatModelsForGroup, sendChatCompletion } from '../aiChat'
import type { UserAvailableChannel } from '../channels'

function streamFrom(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text))
      controller.close()
    },
  })
}

describe('aiChat API', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('posts a streaming chat completion request and collects deltas', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: streamFrom([
        'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
        'data: [DONE]\n\n',
      ].join('')),
    })
    vi.stubGlobal('fetch', fetchMock)

    const deltas: string[] = []
    const result = await sendChatCompletion('sk-test', {
      model: 'gpt-5.4',
      messages: [{ role: 'user', content: 'hello' }],
    }, {
      onDelta: (delta) => deltas.push(delta),
    })

    expect(fetchMock).toHaveBeenCalledWith('/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'sk-test',
      },
      body: JSON.stringify({
        model: 'gpt-5.4',
        messages: [{ role: 'user', content: 'hello' }],
        stream: true,
      }),
      signal: undefined,
    })
    expect(deltas).toEqual(['Hel', 'lo'])
    expect(result.content).toBe('Hello')
  })

  it('posts reasoning and web search options when enabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: streamFrom('data: {"choices":[{"delta":{"content":"Done"}}]}\n\n'),
    })
    vi.stubGlobal('fetch', fetchMock)

    await sendChatCompletion('sk-test', {
      model: 'gpt-5.4',
      messages: [{ role: 'user', content: 'latest news' }],
      reasoning_effort: 'medium',
      tools: [{ type: 'web_search' }],
    })

    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      model: 'gpt-5.4',
      messages: [{ role: 'user', content: 'latest news' }],
      reasoning_effort: 'medium',
      tools: [{ type: 'web_search' }],
      stream: true,
    })
  })

  it('collects reasoning deltas and web search tool events from the stream', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: streamFrom([
        'data: {"choices":[{"delta":{"reasoning_content":"Checking "}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"web_search","function":{"name":"web_search","arguments":"{\\"query\\":\\"Sub2API\\"}"}}]}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"Found it"}}]}\n\n',
        'data: [DONE]\n\n',
      ].join('')),
    })
    vi.stubGlobal('fetch', fetchMock)

    const reasoning: string[] = []
    const tools: string[] = []
    const result = await sendChatCompletion('sk-test', {
      model: 'gpt-5.4',
      messages: [{ role: 'user', content: 'search Sub2API' }],
    }, {
      onThoughtDelta: (delta) => reasoning.push(delta),
      onToolCall: (tool) => tools.push(tool.name),
    })

    expect(reasoning).toEqual(['Checking '])
    expect(tools).toEqual(['web_search'])
    expect(result).toEqual({
      content: 'Found it',
      reasoning: 'Checking ',
      toolCalls: [{
        id: 'call_1',
        index: 0,
        type: 'web_search',
        name: 'web_search',
        arguments: '{"query":"Sub2API"}',
      }],
    })
  })

  it('collects nested reasoning payloads from compatible providers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: streamFrom([
        'data: {"choices":[{"delta":{"reasoning":{"summary":[{"text":"Step 1. "}]}}}]}\n\n',
        'data: {"choices":[{"delta":{"reasoning_summary":[{"text":"Step 2."}]}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"Done"}}]}\n\n',
        'data: [DONE]\n\n',
      ].join('')),
    })
    vi.stubGlobal('fetch', fetchMock)

    const reasoning: string[] = []
    const result = await sendChatCompletion('sk-test', {
      model: 'gpt-5.4',
      messages: [{ role: 'user', content: 'think' }],
    }, {
      onThoughtDelta: (delta) => reasoning.push(delta),
    })

    expect(reasoning).toEqual(['Step 1. ', 'Step 2.'])
    expect(result.reasoning).toBe('Step 1. Step 2.')
  })

  it('yields to the renderer after streaming deltas', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: streamFrom([
        'data: {"choices":[{"delta":{"content":"1"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"2"}}]}\n\n',
        'data: [DONE]\n\n',
      ].join('')),
    })
    const rafMock = vi.fn((callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('requestAnimationFrame', rafMock)

    await sendChatCompletion('sk-test', {
      model: 'gpt-5.4',
      messages: [{ role: 'user', content: 'count' }],
    })

    expect(rafMock).toHaveBeenCalled()
  })

  it('extracts text chat models from the selected group platform', () => {
    const channels: UserAvailableChannel[] = [{
      name: 'OpenAI',
      description: '',
      platforms: [{
        platform: 'openai',
        groups: [{
          id: 7,
          name: 'OpenAI pool',
          platform: 'openai',
          subscription_type: 'standard',
          rate_multiplier: 1,
          is_exclusive: false,
        }],
        supported_models: [
          { name: 'gpt-5.4', platform: 'openai', pricing: { billing_mode: 'token', input_price: null, output_price: null, cache_write_price: null, cache_read_price: null, image_output_price: null, per_request_price: null, intervals: [] } },
          { name: 'gpt-image-2', platform: 'openai', pricing: { billing_mode: 'image', input_price: null, output_price: null, cache_write_price: null, cache_read_price: null, image_output_price: null, per_request_price: null, intervals: [] } },
        ],
      }],
    }]

    expect(extractChatModelsForGroup(channels, 7, 'openai')).toEqual(['gpt-5.4'])
  })
})
