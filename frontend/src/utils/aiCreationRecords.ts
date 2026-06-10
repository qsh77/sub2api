import type { ImageWorkspaceProjectSummary } from '@/api/imageGeneration'

export type AiCreationScope = 'user' | 'admin'
export type AiCreationRecordMode = 'dialogue' | 'image'

export interface StoredAiChatConversation<TMessage = unknown> {
  id: string
  title: string
  messages: TMessage[]
  groupId: number | null
  keyName: string
  model: string
  createdAt: number
  updatedAt: number
}

export interface AiCreationSidebarRecord {
  id: string
  mode: AiCreationRecordMode
  title: string
  createdAt: number
  updatedAt: number
  conversationId?: string
  projectId?: number
}

export function aiChatStorageKey(scope: AiCreationScope) {
  return `sub2api:ai-chat:${scope}:v1`
}

export function aiChatSettingsStorageKey(scope: AiCreationScope) {
  return `sub2api:ai-chat:${scope}:settings:v1`
}

export function readStoredChatConversations<TMessage = unknown>(scope: AiCreationScope): StoredAiChatConversation<TMessage>[] {
  try {
    const value = JSON.parse(localStorage.getItem(aiChatStorageKey(scope)) || '[]') as StoredAiChatConversation<TMessage>[]
    return Array.isArray(value) ? value.filter(isStoredChatConversation) : []
  } catch {
    return []
  }
}

export function writeStoredChatConversations<TMessage>(scope: AiCreationScope, conversations: StoredAiChatConversation<TMessage>[]) {
  localStorage.setItem(aiChatStorageKey(scope), JSON.stringify(conversations.slice(0, 50)))
}

export function chatConversationRecord(conversation: StoredAiChatConversation): AiCreationSidebarRecord {
  return {
    id: `dialogue:${conversation.id}`,
    mode: 'dialogue',
    title: conversation.title || '新对话',
    conversationId: conversation.id,
    createdAt: conversation.createdAt || conversation.updatedAt || Date.now(),
    updatedAt: conversation.updatedAt || conversation.createdAt || Date.now(),
  }
}

export function imageProjectRecord(project: ImageWorkspaceProjectSummary): AiCreationSidebarRecord {
  return {
    id: `image:${project.id}`,
    mode: 'image',
    title: project.title || '未命名图片',
    projectId: project.id,
    createdAt: parseTime(project.created_at),
    updatedAt: parseTime(project.updated_at),
  }
}

export function sortAiCreationRecords(records: AiCreationSidebarRecord[]) {
  return [...records].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function readStoredChatSelection(scope: AiCreationScope) {
  return localStorage.getItem(chatSelectionStorageKey(scope)) || ''
}

export function writeStoredChatSelection(scope: AiCreationScope, conversationId: string | null) {
  writeNullableStorage(chatSelectionStorageKey(scope), conversationId)
}

export function readStoredImageProjectSelection(scope: AiCreationScope) {
  const raw = localStorage.getItem(imageSelectionStorageKey(scope))
  const id = raw ? Number(raw) : 0
  return Number.isFinite(id) && id > 0 ? id : null
}

export function writeStoredImageProjectSelection(scope: AiCreationScope, projectId: number | null) {
  writeNullableStorage(imageSelectionStorageKey(scope), projectId ? String(projectId) : null)
}

function chatSelectionStorageKey(scope: AiCreationScope) {
  return `sub2api:ai-creation:${scope}:selected-chat:v1`
}

function imageSelectionStorageKey(scope: AiCreationScope) {
  return `sub2api:ai-creation:${scope}:selected-image-project:v1`
}

function writeNullableStorage(key: string, value: string | null) {
  if (value) localStorage.setItem(key, value)
  else localStorage.removeItem(key)
}

function isStoredChatConversation<TMessage>(value: StoredAiChatConversation<TMessage>) {
  return !!value && typeof value.id === 'string' && Array.isArray(value.messages)
}

function parseTime(value: string) {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Date.now()
}
