import type { UserAvailableChannel, UserSupportedModel } from './channels'
import { getModelsByPlatform } from '@/composables/useModelWhitelist'

export type AiChatRole = 'system' | 'user' | 'assistant'

export interface AiChatMessage {
  role: AiChatRole
  content: string
}

export interface AiChatCompletionRequest {
  model: string
  messages: AiChatMessage[]
  reasoning_effort?: 'low' | 'medium' | 'high' | 'xhigh'
  tools?: AiChatTool[]
}

export interface AiChatTool {
  type: string
  function?: {
    name: string
    description?: string
    parameters?: unknown
  }
}

export interface AiChatCompletionResult {
  content: string
  reasoning?: string
  toolCalls?: AiChatToolCall[]
}

export interface AiChatToolCall {
  id?: string
  index?: number
  type?: string
  name: string
  arguments: string
}

interface SendChatCompletionOptions {
  signal?: AbortSignal
  onDelta?: (delta: string) => void
  onThoughtDelta?: (delta: string) => void
  onToolCall?: (toolCall: AiChatToolCall) => void
}

interface StreamReadResult {
  content: string
  reasoning: string
  toolCalls: AiChatToolCall[]
}

export async function sendChatCompletion(
  apiKey: string,
  payload: AiChatCompletionRequest,
  options: SendChatCompletionOptions = {}
): Promise<AiChatCompletionResult> {
  const response = await fetch('/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ ...payload, stream: true }),
    signal: options.signal,
  })

  if (!response.ok) {
    const errorBody = await parseJson(response)
    throw new Error(readErrorMessage(errorBody) || `Chat completion failed with status ${response.status}`)
  }

  if (!response.body) {
    const data = await parseJson(response)
    return compactCompletionResult(readCompletionResult(data))
  }

  return compactCompletionResult(await readCompletionStream(response.body, options))
}

export function extractChatModelsForGroup(
  channels: UserAvailableChannel[],
  groupId: number | null,
  platform: string | null | undefined
): string[] {
  if (!groupId || !platform) return fallbackChatModels(platform)
  const models: string[] = []
  const seen = new Set<string>()

  for (const channel of channels) {
    for (const section of channel.platforms) {
      if (section.platform !== platform) continue
      if (!section.groups.some((group) => group.id === groupId)) continue
      for (const model of section.supported_models) {
        if (!isTextChatModel(model)) continue
        if (seen.has(model.name)) continue
        seen.add(model.name)
        models.push(model.name)
      }
    }
  }

  return models.length > 0 ? models : fallbackChatModels(platform)
}

export function fallbackChatModels(platform: string | null | undefined): string[] {
  return getModelsByPlatform(platform || 'anthropic').filter((model) => !isImageModelName(model))
}

async function readCompletionStream(
  body: ReadableStream<Uint8Array>,
  options: SendChatCompletionOptions
): Promise<StreamReadResult> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const result: StreamReadResult = { content: '', reasoning: '', toolCalls: [] }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split(/\r?\n\r?\n/)
    buffer = events.pop() || ''
    let changed = false
    for (const event of events) {
      changed = mergeStreamEvent(result, event, options) || changed
    }
    if (changed) await yieldToRenderer()
  }

  if (buffer.trim()) {
    if (mergeStreamEvent(result, buffer, options)) await yieldToRenderer()
  }

  return result
}

function mergeStreamEvent(result: StreamReadResult, event: string, options: SendChatCompletionOptions): boolean {
  let changed = false
  for (const line of event.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue
    const data = trimmed.slice(5).trim()
    if (!data || data === '[DONE]') continue
    try {
      changed = mergeChunk(result, readCompletionChunk(JSON.parse(data)), options) || changed
    } catch {
      continue
    }
  }
  return changed
}

function mergeChunk(result: StreamReadResult, chunk: StreamReadResult, options: SendChatCompletionOptions): boolean {
  let changed = false
  if (chunk.content) {
    result.content += chunk.content
    options.onDelta?.(chunk.content)
    changed = true
  }
  if (chunk.reasoning) {
    result.reasoning += chunk.reasoning
    options.onThoughtDelta?.(chunk.reasoning)
    changed = true
  }
  for (const toolCall of chunk.toolCalls) {
    mergeToolCall(result.toolCalls, toolCall)
    options.onToolCall?.(toolCall)
    changed = true
  }
  return changed
}

function readCompletionChunk(data: unknown): StreamReadResult {
  const result: StreamReadResult = { content: '', reasoning: '', toolCalls: [] }
  const choices = (data as { choices?: unknown[] })?.choices
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      const item = choice as { delta?: unknown; message?: unknown }
      mergeChatPayload(result, item.delta)
      mergeChatPayload(result, item.message)
    }
    return result
  }

  mergeResponsesPayload(result, data)
  mergeAnthropicPayload(result, data)
  return result
}

function readCompletionResult(data: unknown): StreamReadResult {
  const result: StreamReadResult = { content: '', reasoning: '', toolCalls: [] }
  const choices = (data as { choices?: unknown[] })?.choices
  if (!Array.isArray(choices)) return result
  for (const choice of choices) {
    mergeChatPayload(result, (choice as { message?: unknown })?.message)
  }
  return result
}

function mergeChatPayload(result: StreamReadResult, payload: unknown) {
  if (!payload || typeof payload !== 'object') return
  const record = payload as Record<string, unknown>
  result.content += readText(record.content)
  result.reasoning += readReasoning(record)
  for (const toolCall of readToolCalls(record.tool_calls)) {
    mergeToolCall(result.toolCalls, toolCall)
  }
}

function mergeResponsesPayload(result: StreamReadResult, data: unknown) {
  if (!data || typeof data !== 'object') return
  const record = data as Record<string, unknown>
  if (record.type === 'response.output_text.delta') {
    result.content += readText(record.delta)
  }
  if (record.type === 'response.reasoning_summary_text.delta') {
    result.reasoning += readText(record.delta)
  }
  if (record.type === 'response.output_item.added' && record.item && typeof record.item === 'object') {
    const item = record.item as Record<string, unknown>
    if (isToolItem(item)) {
      mergeToolCall(result.toolCalls, {
        id: readText(item.call_id || item.id),
        index: typeof record.output_index === 'number' ? record.output_index : undefined,
        type: readText(item.type),
        name: readText(item.name || item.type),
        arguments: readText(item.arguments),
      })
    }
  }
}

function mergeAnthropicPayload(result: StreamReadResult, data: unknown) {
  if (!data || typeof data !== 'object') return
  const record = data as Record<string, unknown>
  const delta = record.delta as Record<string, unknown> | undefined
  if (record.type === 'content_block_delta' && delta) {
    result.content += readText(delta.text)
    result.reasoning += readText(delta.thinking)
  }
  if (record.type === 'content_block_start' && record.content_block && typeof record.content_block === 'object') {
    const block = record.content_block as Record<string, unknown>
    if (isToolItem(block)) {
      mergeToolCall(result.toolCalls, {
        id: readText(block.id || block.tool_use_id),
        index: typeof record.index === 'number' ? record.index : undefined,
        type: readText(block.type),
        name: readText(block.name || block.type),
        arguments: block.input ? JSON.stringify(block.input) : '',
      })
    }
  }
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readReasoning(record: Record<string, unknown>): string {
  return [
    record.reasoning_content,
    record.reasoning,
    record.reasoning_summary,
    record.thinking,
  ].map(readReasoningText).join('')
}

function readReasoningText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(readReasoningText).join('')
  if (!value || typeof value !== 'object') return ''

  const record = value as Record<string, unknown>
  return [
    record.text,
    record.summary_text,
    record.content,
    record.delta,
    record.summary,
    record.reasoning_content,
    record.thinking,
  ].map(readReasoningText).join('')
}

function readToolCalls(value: unknown): AiChatToolCall[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const record = item as Record<string, unknown>
    const fn = record.function as Record<string, unknown> | undefined
    return {
      id: readText(record.id),
      index: typeof record.index === 'number' ? record.index : undefined,
      type: readText(record.type),
      name: readText(fn?.name || record.name || record.type),
      arguments: readText(fn?.arguments || record.arguments),
    }
  }).filter((item) => item.name)
}

function isToolItem(item: Record<string, unknown>): boolean {
  const type = readText(item.type)
  const name = readText(item.name)
  return type.includes('tool') || type.includes('function') || type.includes('search') || name.includes('search')
}

function mergeToolCall(items: AiChatToolCall[], incoming: AiChatToolCall) {
  const existing = items.find((item) => (
    incoming.index !== undefined && item.index === incoming.index
  ) || (
    !!incoming.id && item.id === incoming.id
  ))
  if (!existing) {
    items.push({ ...incoming })
    return
  }
  existing.id ||= incoming.id
  existing.type ||= incoming.type
  existing.name ||= incoming.name
  existing.arguments += incoming.arguments
}

function compactCompletionResult(result: StreamReadResult): AiChatCompletionResult {
  const output: AiChatCompletionResult = { content: result.content }
  if (result.reasoning) output.reasoning = result.reasoning
  if (result.toolCalls.length > 0) output.toolCalls = result.toolCalls
  return output
}

function yieldToRenderer(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve())
      return
    }
    setTimeout(resolve, 0)
  })
}

function isTextChatModel(model: UserSupportedModel): boolean {
  return model.pricing?.billing_mode !== 'image' && !isImageModelName(model.name)
}

function isImageModelName(model: string): boolean {
  return model.toLowerCase().includes('image')
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function readErrorMessage(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const record = data as Record<string, unknown>
  const error = record.error
  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).message
    if (typeof message === 'string') return message
  }
  if (typeof record.message === 'string') return record.message
  if (typeof record.detail === 'string') return record.detail
  return ''
}
