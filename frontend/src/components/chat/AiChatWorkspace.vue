<template>
  <AppLayout main-class="p-0">
    <div class="flex h-[calc(100vh-4rem)] min-h-[560px] bg-white text-gray-900 dark:bg-dark-950 dark:text-white">
      <aside class="hidden w-72 shrink-0 border-r border-gray-100 bg-gray-50/80 p-3 dark:border-dark-800 dark:bg-dark-900/70 lg:flex lg:flex-col">
        <button type="button" class="btn btn-primary h-10 w-full justify-center" @click="startNewChat">
          <Icon name="plus" size="sm" class="mr-2" />
          新对话
        </button>
        <div class="mt-4 flex-1 space-y-1 overflow-y-auto">
          <div
            v-for="record in sidebarRecords"
            :key="record.id"
            class="group flex w-full items-center gap-1 rounded-lg transition"
            :class="isSidebarRecordActive(record) ? 'bg-white text-gray-900 shadow-sm dark:bg-dark-800 dark:text-white' : 'text-gray-600 hover:bg-white dark:text-dark-300 dark:hover:bg-dark-800'"
          >
            <button type="button" class="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm" @click="selectSidebarRecord(record)">
              <Icon :name="record.mode === 'image' ? 'sparkles' : 'chat'" size="sm" class="shrink-0" />
              <span class="min-w-0 flex-1 truncate">{{ record.title }}</span>
            </button>
            <button
              v-if="canDeleteSidebarRecord(record)"
              type="button"
              class="mr-2 hidden rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500 disabled:cursor-wait disabled:opacity-50 group-hover:block dark:hover:bg-dark-700"
              :title="deleteSidebarRecordTitle(record)"
              :disabled="deletingRecordId === record.id"
              @click.stop="deleteSidebarRecord(record)"
            >
              <Icon name="trash" size="xs" />
            </button>
          </div>
        </div>
      </aside>

      <section class="flex min-w-0 flex-1 flex-col">
        <header class="border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur dark:border-dark-800 dark:bg-dark-950/95">
          <div class="grid gap-2 md:grid-cols-3">
            <label class="ai-chat-control">
              <span class="ai-chat-label">分组</span>
              <Select
                v-model="selectedGroupId"
                :options="groupOptions"
                :disabled="loading || generating || groupOptions.length === 0"
                searchable="auto"
                placeholder="选择分组"
              />
            </label>
            <label class="ai-chat-control">
              <span class="ai-chat-label">密钥</span>
              <Select
                v-model="selectedKeyValue"
                :options="keyOptions"
                :disabled="loading || generating || keyOptions.length === 0"
                searchable="auto"
                placeholder="选择 API 密钥"
              />
            </label>
            <label class="ai-chat-control">
              <span class="ai-chat-label">模型</span>
              <Select
                v-model="model"
                :options="modelOptions"
                :disabled="loading || generating || modelOptions.length === 0"
                searchable="auto"
                placeholder="选择模型"
              />
            </label>
          </div>
        </header>

        <main ref="messagesEl" class="flex-1 overflow-y-auto px-4 py-6">
          <div v-if="messages.length === 0" class="mx-auto flex h-full max-w-3xl items-center justify-center text-center">
            <div>
              <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900 text-white dark:bg-white dark:text-gray-900">
                <Icon name="sparkles" size="lg" />
              </div>
              <h1 class="mt-4 text-2xl font-semibold">今天想聊什么？</h1>
              <p class="mt-2 text-sm text-gray-500 dark:text-dark-400">选择分组、密钥和模型后开始对话。</p>
            </div>
          </div>

          <div v-else class="mx-auto flex max-w-3xl flex-col gap-6">
            <div
              v-for="message in messages"
              :key="message.id"
              class="flex"
              :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
            >
              <div
                class="max-w-[86%]"
              >
                <div
                  v-if="hasTrace(message)"
                  class="mb-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-dark-700 dark:bg-dark-900 dark:text-dark-300"
                >
                  <button
                    type="button"
                    class="flex w-full items-start justify-between gap-3 text-left"
                    :aria-expanded="!isTraceCollapsed(message)"
                    :title="isTraceCollapsed(message) ? '展开思考链路' : '收起思考链路'"
                    @click="toggleTrace(message)"
                  >
                    <span class="flex min-w-0 flex-1 flex-wrap items-center gap-2 font-medium text-gray-800 dark:text-dark-100">
                      <Icon name="brain" size="xs" />
                      <span>思考链路</span>
                      <span class="text-gray-400">·</span>
                      <span>{{ traceStatus(message) }}</span>
                      <template v-if="thinkingDurationMs(message) !== null">
                        <span class="text-gray-400">·</span>
                        <span>思考时间 {{ formatDuration(thinkingDurationMs(message) || 0) }}</span>
                      </template>
                      <template v-if="totalDurationMs(message) !== null">
                        <span class="text-gray-400">·</span>
                        <span>总耗时 {{ formatDuration(totalDurationMs(message) || 0) }}</span>
                      </template>
                    </span>
                    <span class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-dark-800 dark:hover:text-dark-100">
                      <Icon :name="isTraceCollapsed(message) ? 'chevronRight' : 'chevronDown'" size="xs" />
                      <span class="sr-only">{{ isTraceCollapsed(message) ? '展开' : '收起' }}</span>
                    </span>
                  </button>
                  <div v-if="!isTraceCollapsed(message)" class="mt-2 space-y-2">
                    <div v-if="message.modelName || message.groupName || message.keyName" class="flex flex-wrap gap-1.5">
                      <span v-if="message.groupName" class="ai-chat-trace-pill">{{ message.groupName }}</span>
                      <span v-if="message.keyName" class="ai-chat-trace-pill">{{ message.keyName }}</span>
                      <span v-if="message.modelName" class="ai-chat-trace-pill">{{ message.modelName }}</span>
                    </div>
                    <div v-if="message.traceEvents?.length" class="space-y-1">
                      <div v-for="event in message.traceEvents" :key="`${event.at}-${event.label}`" class="flex gap-2">
                        <span class="w-12 shrink-0 text-gray-400">{{ formatTraceOffset(message, event.at) }}</span>
                        <span>{{ event.label }}</span>
                      </div>
                    </div>
                    <div v-if="publicThinkingSteps(message).length" class="space-y-1.5 rounded-xl bg-white/70 p-2 ring-1 ring-gray-100 dark:bg-dark-800/70 dark:ring-dark-700">
                      <div v-for="step in publicThinkingSteps(message)" :key="step.title" class="grid gap-0.5 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-2">
                        <span class="font-medium text-gray-700 dark:text-dark-100">{{ step.title }}</span>
                        <span class="leading-5 text-gray-500 dark:text-dark-300">{{ step.detail }}</span>
                      </div>
                    </div>
                    <p v-if="message.reasoning" class="whitespace-pre-wrap break-words leading-5 text-gray-700 dark:text-dark-200">{{ message.reasoning }}</p>
                    <div v-if="message.searchEnabled || searchToolCalls(message).length > 0" class="flex flex-wrap items-center gap-2">
                      <Icon name="globe" size="xs" />
                      <span>联网搜索</span>
                      <span v-if="formatSearchQuery(message)" class="truncate text-gray-400">{{ formatSearchQuery(message) }}</span>
                    </div>
                    <div v-if="message.pending" class="flex items-center gap-2 text-gray-400">
                      <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-current"></span>
                      <span>生成中</span>
                    </div>
                  </div>
                </div>
                <div
                  class="whitespace-pre-wrap break-words text-sm leading-7"
                  :class="message.role === 'user'
                    ? 'rounded-3xl bg-gray-900 px-5 py-3 text-white dark:bg-white dark:text-gray-900'
                    : message.error
                      ? 'rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
                      : 'text-gray-900 dark:text-dark-50'"
                >
                  <span v-if="message.content">{{ message.content }}</span>
                  <span v-else-if="message.pending" class="inline-flex items-center gap-2 text-gray-400">
                    <span class="h-2 w-2 animate-pulse rounded-full bg-current"></span>
                    正在思考
                  </span>
                </div>
              </div>
            </div>
          </div>
        </main>

        <footer class="border-t border-gray-100 bg-white/95 px-4 py-3 backdrop-blur dark:border-dark-800 dark:bg-dark-950/95">
          <div class="mx-auto max-w-3xl">
            <p v-if="unavailableMessage" class="mb-2 text-sm text-red-600 dark:text-red-400">{{ unavailableMessage }}</p>
            <div class="ai-creation-composer">
              <textarea
                ref="promptEl"
                v-model="prompt"
                rows="1"
                class="max-h-40 min-h-20 w-full resize-none border-0 bg-transparent px-3 py-3 text-base text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
                placeholder="输入消息"
                :disabled="generating"
                @keydown.enter.exact.prevent="send"
              />
              <div class="ai-creation-actions">
                <AiModeTabs :model-value="activeMode" @update:model-value="emit('mode-change', $event)" />
                <div class="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    class="ai-chat-toggle"
                    :class="thinkingEnabled ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-dark-700 dark:text-dark-300 dark:hover:bg-dark-800'"
                    :disabled="generating"
                    title="深度思考"
                    @click="thinkingEnabled = !thinkingEnabled"
                  >
                    <Icon name="brain" size="sm" />
                    <span>深度思考</span>
                  </button>
                  <button
                    type="button"
                    class="ai-chat-toggle"
                    :class="webSearchEnabled ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-dark-700 dark:text-dark-300 dark:hover:bg-dark-800'"
                    :disabled="generating"
                    title="联网搜索"
                    @click="webSearchEnabled = !webSearchEnabled"
                  >
                    <Icon name="globe" size="sm" />
                    <span>联网搜索</span>
                  </button>
                  <button
                    v-if="generating"
                    type="button"
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-700 dark:bg-dark-700 dark:text-dark-100"
                    title="停止"
                    @click="stop"
                  >
                    <Icon name="x" size="sm" />
                  </button>
                  <button
                    v-else
                    type="button"
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white disabled:cursor-not-allowed disabled:bg-gray-300 dark:bg-white dark:text-gray-900 dark:disabled:bg-dark-700"
                    :disabled="!canSend"
                    title="发送"
                    @click="send"
                  >
                    <Icon name="arrowUp" size="sm" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import Select from '@/components/common/Select.vue'
import Icon from '@/components/icons/Icon.vue'
import AiModeTabs, { type AiCreationMode } from '@/components/ai/AiModeTabs.vue'
import { adminAPI } from '@/api/admin'
import { keysAPI, userChannelsAPI } from '@/api'
import { extractChatModelsForGroup, fallbackChatModels, sendChatCompletion, type AiChatMessage, type AiChatRole, type AiChatCompletionRequest, type AiChatToolCall } from '@/api/aiChat'
import { deleteImageProject, listImageProjects, type ImageWorkspaceProjectSummary } from '@/api/imageGeneration'
import { extractApiErrorMessage } from '@/utils/apiError'
import {
  aiChatSettingsStorageKey,
  chatConversationRecord,
  imageProjectRecord,
  readStoredChatConversations,
  readStoredChatSelection,
  readStoredImageProjectSelection,
  sortAiCreationRecords,
  writeStoredChatConversations,
  writeStoredChatSelection,
  writeStoredImageProjectSelection,
  type AiCreationSidebarRecord,
  type StoredAiChatConversation,
} from '@/utils/aiCreationRecords'
import type { AdminGroup, ApiKey, Group, SelectOption } from '@/types'
import type { UserAvailableChannel } from '@/api/channels'

type WorkspaceScope = 'user' | 'admin'
type ChatGroup = Group | AdminGroup

interface ChatMessage extends AiChatMessage {
  id: string
  pending?: boolean
  error?: boolean
  reasoning?: string
  toolCalls?: AiChatToolCall[]
  thinkingEnabled?: boolean
  searchEnabled?: boolean
  modelName?: string
  groupName?: string
  keyName?: string
  inputPreview?: string
  contextMessageCount?: number
  traceCollapsed?: boolean
  startedAt?: number
  firstReasoningAt?: number
  firstContentAt?: number
  completedAt?: number
  traceEvents?: ChatTraceEvent[]
  createdAt: number
}

interface ChatTraceEvent {
  label: string
  at: number
}

interface PublicThinkingStep {
  title: string
  detail: string
}

interface ChatConversation extends StoredAiChatConversation<ChatMessage> {}

const props = withDefaults(defineProps<{ scope: WorkspaceScope; activeMode?: AiCreationMode }>(), {
  activeMode: 'dialogue',
})
const emit = defineEmits<{ 'mode-change': [value: AiCreationMode] }>()

const settingsStorageKey = aiChatSettingsStorageKey(props.scope)
const storedSettings = readStoredSettings()
const isAdmin = computed(() => props.scope === 'admin')

const loading = ref(false)
const generating = ref(false)
const adminGroups = ref<AdminGroup[]>([])
const userGroups = ref<Group[]>([])
const activeKeys = ref<ApiKey[]>([])
const channels = ref<UserAvailableChannel[]>([])
const imageProjects = ref<ImageWorkspaceProjectSummary[]>([])
const selectedGroupId = ref<string | number | boolean | null>(null)
const selectedKeyValue = ref<string | number | boolean | null>(null)
const model = ref<string | number | boolean | null>(null)
const thinkingEnabled = ref(storedSettings.thinkingEnabled)
const webSearchEnabled = ref(storedSettings.webSearchEnabled)
const prompt = ref('')
const activeConversationId = ref<string | null>(null)
const conversations = ref<ChatConversation[]>(readStoredChatConversations<ChatMessage>(props.scope))
const messagesEl = ref<HTMLElement | null>(null)
const promptEl = ref<HTMLTextAreaElement | null>(null)
const traceClock = ref(Date.now())
const deletingRecordId = ref('')
let controller: AbortController | null = null
let traceTimer: ReturnType<typeof setInterval> | null = null

const availableGroups = computed<ChatGroup[]>(() => isAdmin.value ? adminGroups.value : userGroups.value)
const selectedGroup = computed<ChatGroup | null>(() => availableGroups.value.find((group) => group.id === Number(selectedGroupId.value)) || null)
const keyOptions = computed<SelectOption[]>(() => filteredKeys.value.map((key) => ({
  value: key.id,
  label: apiKeyOptionLabel(key),
})))
const groupOptions = computed<SelectOption[]>(() => availableGroups.value.map((group) => ({
  value: group.id,
  label: `${group.name} · ${platformLabel(group.platform)}`,
})))
const selectedKey = computed(() => filteredKeys.value.find((key) => key.id === Number(selectedKeyValue.value)) || null)
const filteredKeys = computed(() => {
  const groupId = Number(selectedGroupId.value)
  if (!groupId) return []
  return activeKeys.value.filter((key) => key.status === 'active' && key.group_id === groupId)
})
const modelOptions = computed<SelectOption[]>(() => currentModels.value.map((item) => ({ value: item, label: item })))
const currentModels = computed(() => {
  const group = selectedGroup.value
  if (!group) return []
  if (isAdmin.value) {
    const configured = (group as AdminGroup).models_list_config?.models?.filter((item) => item && !item.toLowerCase().includes('image')) || []
    return configured.length > 0 ? configured : fallbackChatModels(group.platform)
  }
  return extractChatModelsForGroup(channels.value, group.id, group.platform)
})
const sortedConversations = computed(() => [...conversations.value].sort((a, b) => b.updatedAt - a.updatedAt))
const sidebarRecords = computed(() => sortAiCreationRecords([
  ...conversations.value.map(chatConversationRecord),
  ...imageProjects.value.map(imageProjectRecord),
]))
const activeConversation = computed(() => conversations.value.find((item) => item.id === activeConversationId.value) || null)
const messages = computed(() => activeConversation.value?.messages || [])
const trimmedPrompt = computed(() => prompt.value.trim())
const canSend = computed(() => !generating.value && !!selectedKey.value && !!model.value && !!trimmedPrompt.value)
const unavailableMessage = computed(() => {
  if (loading.value) return ''
  if (availableGroups.value.length === 0) return '没有可用分组'
  if (!selectedGroup.value) return '请选择分组'
  if (filteredKeys.value.length === 0) return '当前分组没有可用 API 密钥'
  if (!selectedKey.value) return '请选择 API 密钥'
  if (currentModels.value.length === 0) return '当前分组没有可用聊天模型'
  if (!model.value) return '请选择模型'
  return ''
})

watch(availableGroups, (groups) => {
  if (!groups.some((group) => group.id === Number(selectedGroupId.value))) {
    selectedGroupId.value = preferredGroupId(groups)
  }
}, { immediate: true })

watch(selectedGroupId, () => {
  selectedKeyValue.value = null
}, { immediate: true })

watch(filteredKeys, (items) => {
  if (!items.some((key) => key.id === Number(selectedKeyValue.value))) {
    selectedKeyValue.value = items[0]?.id || null
  }
}, { immediate: true })

watch(currentModels, (items) => {
  if (!items.includes(String(model.value || ''))) {
    model.value = items[0] || null
  }
}, { immediate: true })

watch(conversations, () => {
  writeStoredChatConversations(props.scope, conversations.value)
}, { deep: true })

watch([thinkingEnabled, webSearchEnabled], () => {
  localStorage.setItem(settingsStorageKey, JSON.stringify({
    thinkingEnabled: thinkingEnabled.value,
    webSearchEnabled: webSearchEnabled.value,
  }))
})

watch(messages, () => {
  void nextTick(scrollToBottom)
}, { deep: true })

onMounted(() => {
  traceTimer = setInterval(() => {
    if (generating.value) traceClock.value = Date.now()
  }, 500)
  void loadData()
})
onBeforeUnmount(() => {
  controller?.abort()
  if (traceTimer) clearInterval(traceTimer)
})

async function loadData() {
  loading.value = true
  try {
    if (isAdmin.value) {
      const [groups, keys] = await Promise.all([
        adminAPI.groups.getAll(),
        keysAPI.list(1, 100, { status: 'active' }),
      ])
      adminGroups.value = groups.filter((group) => group.status === 'active')
      activeKeys.value = keys.items.filter((key) => key.status === 'active' && !!key.group_id)
    } else {
      const [keys, channelList] = await Promise.all([
        keysAPI.list(1, 100, { status: 'active' }),
        userChannelsAPI.getAvailable(),
      ])
      channels.value = channelList
      activeKeys.value = keys.items.filter((key) => key.status === 'active' && !!key.group_id)
      userGroups.value = collectUserGroups(channelList, activeKeys.value)
    }
    await loadImageProjects()
    restoreSelectedConversation()
  } finally {
    loading.value = false
  }
}

async function loadImageProjects() {
  try {
    const result = isAdmin.value
      ? await adminAPI.images.list({ page: 1, page_size: 50 })
      : await listImageProjects({ page: 1, page_size: 50 })
    imageProjects.value = result.items
  } catch {
    imageProjects.value = []
  }
}

async function send() {
  if (!canSend.value || !selectedKey.value) return
  const text = trimmedPrompt.value
  const conversation = ensureConversation(text)
  const userMessage = createMessage('user', text)
  const assistantMessage = createMessage('assistant', '', true)
  assistantMessage.thinkingEnabled = thinkingEnabled.value
  assistantMessage.searchEnabled = webSearchEnabled.value
  assistantMessage.modelName = String(model.value)
  assistantMessage.groupName = selectedGroup.value?.name || ''
  assistantMessage.keyName = apiKeyOptionLabel(selectedKey.value)
  assistantMessage.inputPreview = text
  assistantMessage.startedAt = Date.now()
  assistantMessage.traceEvents = [{ label: '理解问题', at: assistantMessage.startedAt }]
  conversation.messages.push(userMessage, assistantMessage)
  conversation.groupId = Number(selectedGroupId.value) || null
  conversation.keyName = apiKeyOptionLabel(selectedKey.value)
  conversation.model = String(model.value)
  touchConversation(conversation)
  prompt.value = ''
  generating.value = true
  controller?.abort()
  controller = new AbortController()
  void nextTick(scrollToBottom)

  try {
    const history = conversation.messages
      .filter((message) => message.id !== assistantMessage.id && !message.pending && !message.error)
      .map((message): AiChatMessage => ({ role: message.role, content: message.content }))
    assistantMessage.contextMessageCount = history.length
    addTraceEvent(assistantMessage, `整理上下文（${history.length} 条消息）`)
    if (thinkingEnabled.value) addTraceEvent(assistantMessage, '启用深度思考')
    if (webSearchEnabled.value) addTraceEvent(assistantMessage, '准备联网搜索')
    addTraceEvent(assistantMessage, '发送请求')

    const payload: AiChatCompletionRequest = {
      model: String(model.value),
      messages: history,
    }
    if (thinkingEnabled.value) payload.reasoning_effort = 'medium'
    if (webSearchEnabled.value) payload.tools = [{ type: 'web_search' }]

    const result = await sendChatCompletion(selectedKey.value.key, payload, {
      signal: controller.signal,
      onDelta: (delta) => {
        if (!assistantMessage.firstContentAt) {
          assistantMessage.firstContentAt = Date.now()
          addTraceEvent(assistantMessage, '开始输出')
        }
        assistantMessage.content += delta
        touchConversation(conversation)
      },
      onThoughtDelta: (delta) => {
        if (!assistantMessage.firstReasoningAt) {
          assistantMessage.firstReasoningAt = Date.now()
          addTraceEvent(assistantMessage, '收到可展示推理摘要')
        }
        assistantMessage.reasoning = `${assistantMessage.reasoning || ''}${delta}`
        touchConversation(conversation)
      },
      onToolCall: (toolCall) => {
        upsertToolCall(assistantMessage, toolCall)
        addTraceEvent(assistantMessage, `调用 ${toolCall.name}`)
        touchConversation(conversation)
      },
    })
    if (!assistantMessage.content) assistantMessage.content = result.content
    if (!assistantMessage.reasoning && result.reasoning) assistantMessage.reasoning = result.reasoning
    for (const toolCall of result.toolCalls || []) upsertToolCall(assistantMessage, toolCall)
    if (assistantMessage.content && !assistantMessage.firstContentAt) assistantMessage.firstContentAt = Date.now()
    assistantMessage.pending = false
    assistantMessage.completedAt = Date.now()
    addTraceEvent(assistantMessage, '完成')
    touchConversation(conversation)
  } catch (err: unknown) {
    assistantMessage.pending = false
    assistantMessage.completedAt = Date.now()
    if ((err as Error)?.name === 'AbortError') {
      if (!assistantMessage.content) assistantMessage.content = '已停止'
      addTraceEvent(assistantMessage, '已停止')
    } else {
      assistantMessage.error = true
      assistantMessage.content = readErrorText(err)
      addTraceEvent(assistantMessage, '请求失败')
    }
    touchConversation(conversation)
  } finally {
    generating.value = false
    controller = null
    void nextTick(() => promptEl.value?.focus())
  }
}

function stop() {
  controller?.abort()
}

function startNewChat() {
  activeConversationId.value = null
  writeStoredChatSelection(props.scope, null)
  prompt.value = ''
  void nextTick(() => promptEl.value?.focus())
}

function selectConversation(id: string) {
  activeConversationId.value = id
  writeStoredChatSelection(props.scope, id)
}

function selectSidebarRecord(record: AiCreationSidebarRecord) {
  if (record.mode === 'image' && record.projectId) {
    writeStoredImageProjectSelection(props.scope, record.projectId)
    emit('mode-change', 'image')
    return
  }
  if (record.conversationId) selectConversation(record.conversationId)
}

function canDeleteSidebarRecord(record: AiCreationSidebarRecord) {
  return (record.mode === 'dialogue' && !!record.conversationId) || (record.mode === 'image' && !!record.projectId)
}

function deleteSidebarRecordTitle(record: AiCreationSidebarRecord) {
  return record.mode === 'image' ? '删除作画记录' : '删除对话'
}

async function deleteSidebarRecord(record: AiCreationSidebarRecord) {
  if (record.mode === 'dialogue' && record.conversationId) {
    deleteConversation(record.conversationId)
    return
  }
  if (record.mode === 'image' && record.projectId) {
    await deleteImageProjectRecord(record.projectId, record.id)
  }
}

function deleteConversation(id: string) {
  conversations.value = conversations.value.filter((item) => item.id !== id)
  if (activeConversationId.value === id) activeConversationId.value = sortedConversations.value[0]?.id || null
  writeStoredChatSelection(props.scope, activeConversationId.value)
}

async function deleteImageProjectRecord(projectId: number, recordId: string) {
  if (deletingRecordId.value) return
  deletingRecordId.value = recordId
  try {
    if (isAdmin.value) await adminAPI.images.deleteProject(projectId)
    else await deleteImageProject(projectId)
    imageProjects.value = imageProjects.value.filter((project) => project.id !== projectId)
    if (readStoredImageProjectSelection(props.scope) === projectId) {
      writeStoredImageProjectSelection(props.scope, imageProjects.value[0]?.id || null)
    }
  } catch (err: unknown) {
    console.error(readErrorText(err))
  } finally {
    deletingRecordId.value = ''
  }
}

function ensureConversation(seed: string): ChatConversation {
  if (activeConversation.value) return activeConversation.value
  const conversation: ChatConversation = {
    id: newId(),
    title: titleFromPrompt(seed),
    messages: [],
    groupId: Number(selectedGroupId.value) || null,
    keyName: selectedKey.value?.name || '',
    model: String(model.value || ''),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  conversations.value.unshift(conversation)
  activeConversationId.value = conversation.id
  writeStoredChatSelection(props.scope, conversation.id)
  return conversation
}

function createMessage(role: AiChatRole, content: string, pending = false): ChatMessage {
  return {
    id: newId(),
    role,
    content,
    pending,
    createdAt: Date.now(),
  }
}

function hasTrace(message: ChatMessage) {
  if (message.role !== 'assistant' || message.error) return false
  return !!message.reasoning || !!message.toolCalls?.length || !!message.thinkingEnabled || !!message.searchEnabled
}

function traceStatus(message: ChatMessage) {
  if (message.pending) return '生成中'
  if (message.reasoning) return '已收到可展示推理摘要'
  if (message.searchEnabled || searchToolCalls(message).length > 0) return '已请求联网搜索'
  if (message.thinkingEnabled) return '可解释摘要'
  return '基础过程'
}

function isTraceCollapsed(message: ChatMessage) {
  return !!message.traceCollapsed
}

function toggleTrace(message: ChatMessage) {
  message.traceCollapsed = !isTraceCollapsed(message)
}

function publicThinkingSteps(message: ChatMessage): PublicThinkingStep[] {
  if (message.role !== 'assistant' || message.error) return []
  const promptText = compactText(message.inputPreview || previousUserPrompt(message), 48)
  const contextCount = message.contextMessageCount || inferredContextCount(message)
  const hasSearch = message.searchEnabled || searchToolCalls(message).length > 0
  const steps: PublicThinkingStep[] = [
    {
      title: '理解需求',
      detail: promptText ? `围绕「${promptText}」确定回答目标。` : '围绕用户最新消息确定回答目标。',
    },
    {
      title: '整理上下文',
      detail: contextCount > 1 ? `结合本轮和前文共 ${contextCount} 条消息。` : '使用本轮消息作为主要上下文。',
    },
    {
      title: hasSearch ? '检索判断' : '选择路径',
      detail: hasSearch ? '按开关和工具返回判断是否需要联网信息。' : '未启用联网搜索时，使用当前对话上下文直接组织回答。',
    },
    {
      title: '形成回答',
      detail: message.reasoning ? '上游返回了可展示推理摘要，下面保留该摘要内容。' : '将可用信息整理成直接可读的最终回复。',
    },
  ]
  if (message.pending) {
    steps.push({ title: '输出状态', detail: message.firstContentAt ? '已经开始流式输出。' : '正在等待模型返回首段输出。' })
  }
  return steps
}

function thinkingDurationMs(message: ChatMessage) {
  if (!message.startedAt) return null
  return Math.max(0, (message.firstContentAt || message.completedAt || traceClock.value) - message.startedAt)
}

function totalDurationMs(message: ChatMessage) {
  if (!message.startedAt) return null
  return Math.max(0, (message.completedAt || traceClock.value) - message.startedAt)
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`
}

function formatTraceOffset(message: ChatMessage, at: number) {
  return `+${formatDuration(Math.max(0, at - (message.startedAt || at)))}`
}

function previousUserPrompt(message: ChatMessage) {
  const index = messages.value.findIndex((item) => item.id === message.id)
  for (let i = index - 1; i >= 0; i -= 1) {
    const item = messages.value[i]
    if (item.role === 'user' && item.content.trim()) return item.content
  }
  return ''
}

function inferredContextCount(message: ChatMessage) {
  const index = messages.value.findIndex((item) => item.id === message.id)
  return index > 0 ? index : 1
}

function compactText(value: string, maxLength: number) {
  const oneLine = value.replace(/\s+/g, ' ').trim()
  return oneLine.length > maxLength ? `${oneLine.slice(0, maxLength)}...` : oneLine
}

function addTraceEvent(message: ChatMessage, label: string) {
  message.traceEvents ||= []
  message.traceEvents.push({ label, at: Date.now() })
}

function searchToolCalls(message: ChatMessage) {
  return (message.toolCalls || []).filter((toolCall) => {
    const value = `${toolCall.type || ''} ${toolCall.name}`.toLowerCase()
    return value.includes('search')
  })
}

function formatSearchQuery(message: ChatMessage) {
  for (const toolCall of searchToolCalls(message)) {
    const query = readToolQuery(toolCall.arguments)
    if (query) return query
  }
  return ''
}

function readToolQuery(args: string) {
  if (!args) return ''
  try {
    const value = JSON.parse(args) as { query?: unknown }
    return typeof value.query === 'string' ? value.query : ''
  } catch {
    return ''
  }
}

function upsertToolCall(message: ChatMessage, toolCall: AiChatToolCall) {
  message.toolCalls ||= []
  const existing = message.toolCalls.find((item) => (
    toolCall.index !== undefined && item.index === toolCall.index
  ) || (
    !!toolCall.id && item.id === toolCall.id
  ))
  if (!existing) {
    message.toolCalls.push({ ...toolCall })
    return
  }
  existing.id ||= toolCall.id
  existing.type ||= toolCall.type
  existing.name ||= toolCall.name
  existing.arguments += toolCall.arguments
}

function touchConversation(conversation: ChatConversation) {
  conversation.updatedAt = Date.now()
  if (!conversation.title && conversation.messages[0]?.content) {
    conversation.title = titleFromPrompt(conversation.messages[0].content)
  }
}

function isSidebarRecordActive(record: AiCreationSidebarRecord) {
  return record.mode === 'dialogue' && record.conversationId === activeConversationId.value
}

function restoreSelectedConversation() {
  if (activeConversationId.value && conversations.value.some((item) => item.id === activeConversationId.value)) return
  const storedChatId = readStoredChatSelection(props.scope)
  if (storedChatId && conversations.value.some((item) => item.id === storedChatId)) {
    activeConversationId.value = storedChatId
    return
  }
  const hasSelectedImage = readStoredImageProjectSelection(props.scope)
  activeConversationId.value = hasSelectedImage ? null : sortedConversations.value[0]?.id || null
}

function collectUserGroups(channelList: UserAvailableChannel[], keys: ApiKey[]): Group[] {
  const groups = new Map<number, Group>()
  for (const key of keys) {
    if (key.group) groups.set(key.group.id, key.group)
  }
  for (const channel of channelList) {
    for (const section of channel.platforms) {
      for (const group of section.groups) {
        if (!keys.some((key) => key.group_id === group.id)) continue
        groups.set(group.id, {
          id: group.id,
          name: group.name,
          description: null,
          platform: group.platform as Group['platform'],
          rate_multiplier: group.rate_multiplier,
          rpm_limit: undefined,
          is_exclusive: group.is_exclusive,
          status: 'active',
          subscription_type: group.subscription_type as Group['subscription_type'],
          daily_limit_usd: null,
          weekly_limit_usd: null,
          monthly_limit_usd: null,
          allow_image_generation: false,
          allow_live: false,
          allow_batch_image_generation: false,
          image_rate_independent: false,
          image_rate_multiplier: 1,
          batch_image_discount_multiplier: 1,
          batch_image_hold_multiplier: 1,
          image_price_1k: null,
          image_price_2k: null,
          image_price_4k: null,
          video_rate_independent: false,
          video_rate_multiplier: 1,
          video_price_480p: null,
          video_price_720p: null,
          video_price_1080p: null,
          web_search_price_per_call: null,
          peak_rate_enabled: false,
          peak_start: '',
          peak_end: '',
          peak_rate_multiplier: 1,
          claude_code_only: false,
          fallback_group_id: null,
          fallback_group_id_on_invalid_request: null,
          require_oauth_only: false,
          require_privacy_set: false,
          created_at: '',
          updated_at: '',
        })
      }
    }
  }
  return Array.from(groups.values())
}

function preferredGroupId(groups: ChatGroup[]) {
  const firstKeyGroup = activeKeys.value.find((key) => key.status === 'active' && key.group_id)?.group_id
  if (firstKeyGroup && groups.some((group) => group.id === firstKeyGroup)) return firstKeyGroup
  return groups[0]?.id || null
}

function readStoredSettings() {
  try {
    const value = JSON.parse(localStorage.getItem(settingsStorageKey) || '{}') as Partial<{
      thinkingEnabled: boolean
      webSearchEnabled: boolean
    }>
    return {
      thinkingEnabled: value.thinkingEnabled !== false,
      webSearchEnabled: value.webSearchEnabled === true,
    }
  } catch {
    return { thinkingEnabled: true, webSearchEnabled: false }
  }
}

function scrollToBottom() {
  const el = messagesEl.value
  if (!el) return
  el.scrollTop = el.scrollHeight
}

function newId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function titleFromPrompt(value: string) {
  const oneLine = value.replace(/\s+/g, ' ').trim()
  return oneLine.length > 28 ? `${oneLine.slice(0, 28)}...` : oneLine || '新对话'
}

function platformLabel(platform: string) {
  if (platform === 'openai') return 'OpenAI'
  if (platform === 'anthropic') return 'Claude'
  if (platform === 'gemini') return 'Gemini'
  if (platform === 'antigravity') return 'Antigravity'
  return platform
}

function apiKeyOptionLabel(key: ApiKey) {
  return key.name || `API Key #${key.id}`
}

function readErrorText(err: unknown) {
  if (err instanceof Error) return extractApiErrorMessage(err, err.message)
  return typeof err === 'string' ? err : '聊天请求失败'
}
</script>

<style scoped>
.ai-chat-control {
  @apply flex min-w-0 flex-col gap-1;
}

.ai-chat-label {
  @apply text-xs font-medium text-gray-500 dark:text-dark-400;
}

.ai-chat-toggle {
  @apply inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60;
}

.ai-chat-trace-pill {
  @apply rounded-full bg-white px-2 py-0.5 text-[11px] text-gray-500 ring-1 ring-gray-200 dark:bg-dark-800 dark:text-dark-300 dark:ring-dark-700;
}

.ai-chat-control :deep(.select-trigger) {
  @apply h-9 rounded-lg px-3 py-1.5 text-sm;
}

.ai-creation-composer {
  @apply rounded-[1.75rem] border border-gray-200 bg-white p-2 shadow-xl shadow-gray-200/70 dark:border-dark-700 dark:bg-dark-900 dark:shadow-black/20;
}

.ai-creation-actions {
  @apply flex flex-col gap-2 border-t border-gray-100 px-1 pt-2 dark:border-dark-800 sm:flex-row sm:items-center sm:justify-between;
}
</style>
