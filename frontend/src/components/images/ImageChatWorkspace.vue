<template>
  <AppLayout main-class="p-0">
    <div class="flex h-[calc(100vh-4rem)] min-h-[560px] bg-slate-50 text-gray-900 dark:bg-dark-950 dark:text-white">
      <aside class="hidden w-72 shrink-0 border-r border-gray-100 bg-white/80 p-3 dark:border-dark-800 dark:bg-dark-900/70 lg:flex lg:flex-col">
        <button type="button" class="btn btn-primary h-10 w-full justify-center" :disabled="loading" @click="startNewProject">
          新对话
        </button>
        <div class="mt-4 flex-1 space-y-2 overflow-y-auto">
          <div
            v-for="record in sidebarRecords"
            :key="record.id"
            class="group flex w-full min-w-0 items-center gap-1 rounded-2xl border bg-white shadow-sm transition dark:bg-dark-800"
            :class="isSidebarRecordActive(record) ? 'border-gray-900 text-gray-900 dark:border-white dark:text-white' : 'border-gray-100 text-gray-600 hover:border-gray-200 dark:border-dark-700 dark:text-dark-300 dark:hover:border-dark-600'"
          >
            <button type="button" class="flex min-w-0 flex-1 items-center gap-2 px-3 py-3 text-left text-sm" @click="selectSidebarRecord(record)">
              <Icon :name="record.mode === 'image' ? 'sparkles' : 'chat'" size="sm" class="shrink-0" />
              <span class="block min-w-0 flex-1 truncate font-medium">{{ record.title }}</span>
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
        <header class="border-b border-gray-100 bg-white/95 px-4 py-4 backdrop-blur dark:border-dark-800 dark:bg-dark-950/95">
          <div class="grid items-end gap-2 md:grid-cols-2 xl:grid-cols-[minmax(120px,0.8fr)_minmax(140px,0.9fr)_minmax(150px,0.9fr)_88px]">
            <label v-if="isAdmin" class="image-control-field">
              <span class="image-control-label">分组</span>
              <Select
                v-model="selectedGroupId"
                class="image-control-select"
                :options="groupOptions"
                :disabled="loading || generating || groups.length === 0"
                placeholder="选择分组"
              />
            </label>
            <label class="image-control-field">
              <span class="image-control-label">密钥</span>
              <Select
                v-model="selectedKeyValue"
                class="image-control-select"
                :options="keyOptions"
                :disabled="loading || generating || activeKeys.length === 0"
                placeholder="选择 API 密钥"
              />
            </label>
            <label class="image-control-field">
              <span class="image-control-label">模型</span>
              <Select v-model="model" class="image-control-select" :options="modelOptions" :disabled="generating" />
            </label>
            <label class="image-control-field">
              <span class="image-control-label">尺寸</span>
              <Select v-model="size" class="image-control-select" :options="sizeOptions" :disabled="generating" />
            </label>
          </div>
        </header>

        <main ref="chatEl" class="flex-1 space-y-8 overflow-y-auto px-4 py-8 pb-36 sm:px-6 lg:px-8">
          <div v-if="chatItems.length === 0 && visiblePendingMessages.length === 0 && !uploadPreviewUrl && !generating" class="flex min-h-[45vh] items-center justify-center text-center">
            <div class="max-w-md">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">想生成什么图片？</h2>
              <p class="mt-2 text-sm text-gray-500 dark:text-dark-400">直接输入一句话。生成后继续描述要怎么改。</p>
            </div>
          </div>

          <template v-for="item in chatItems" :key="item.version.id">
            <div class="flex justify-end">
              <div class="max-w-[82%] rounded-[1.5rem] bg-gray-900 px-5 py-3 text-sm leading-6 text-white shadow-sm">
                {{ item.prompt }}
              </div>
            </div>

            <div class="max-w-3xl">
              <button type="button" class="mb-3 block text-left text-sm text-gray-400" @click="toggleThought(versionThoughtKey(item.version))">
                {{ versionThoughtLabel(item.version) }}
              </button>
              <div v-if="expandedThoughtKey === versionThoughtKey(item.version)" class="mb-4 max-w-md rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm dark:border-dark-800 dark:bg-dark-900">
                <div v-for="step in versionThoughtSteps(item.version)" :key="step.label" class="flex gap-3 py-1.5">
                  <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gray-400 dark:bg-dark-500"></span>
                  <div>
                    <p class="font-medium text-gray-800 dark:text-dark-100">{{ step.label }}</p>
                    <p v-if="step.detail" class="mt-0.5 text-gray-500 dark:text-dark-400">{{ step.detail }}</p>
                  </div>
                </div>
              </div>
              <figure
                class="group relative inline-block overflow-hidden rounded-[2rem] bg-gray-100 shadow-sm ring-offset-2 ring-offset-white dark:bg-dark-800 dark:ring-offset-dark-950"
                :class="item.version.id === selectedVersionId ? 'ring-2 ring-gray-900 dark:ring-white' : ''"
              >
                <img
                  v-if="versionSrc(item.version)"
                  :src="versionSrc(item.version)"
                  :alt="`generated-image-${item.version.id}`"
                  class="max-h-[460px] w-full max-w-[560px] cursor-pointer object-contain"
                  @click="selectVersionForEdit(item.version.id)"
                  @error="markVersionImageFailed(item.version)"
                  @load="markVersionImageLoaded(item.version)"
                />
                <div v-else class="flex h-44 w-72 max-w-full items-center justify-center text-sm text-gray-400 dark:text-dark-400">
                  {{ versionLoadLabel(item.version) }}
                </div>
                <div class="absolute inset-x-0 bottom-0 flex items-center justify-end gap-3 p-3">
                  <div class="flex items-center gap-2">
                    <a v-if="versionSrc(item.version)" class="flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-sm text-white/80 backdrop-blur hover:bg-black/45 hover:text-white" title="下载" :href="versionSrc(item.version)" :download="`image-${item.version.id}.png`" @click.stop>
                      ⇩
                    </a>
                  </div>
                </div>
              </figure>
            </div>
          </template>

          <div v-if="uploadPreviewUrl" class="flex justify-end">
            <figure class="overflow-hidden rounded-[2rem] bg-gray-100 shadow-sm dark:bg-dark-800">
              <img :src="uploadPreviewUrl" alt="selected-upload-image" class="max-h-72 w-full max-w-[280px] object-contain" />
            </figure>
          </div>

          <template v-for="message in visiblePendingMessages" :key="message.id">
            <div class="flex justify-end">
              <div class="flex max-w-[82%] flex-col items-end gap-3">
                <figure v-for="(image, index) in message.sourceImages" :key="`${message.id}-source-${index}`" class="overflow-hidden rounded-[2rem] bg-gray-100 shadow-sm dark:bg-dark-800">
                  <img :src="image.url" :alt="`uploaded-source-image-${index + 1}`" class="max-h-72 w-full max-w-[280px] object-contain" />
                </figure>
                <div v-if="message.prompt" class="rounded-[1.5rem] bg-gray-900 px-5 py-3 text-sm leading-6 text-white shadow-sm">
                  {{ message.prompt }}
                </div>
              </div>
            </div>
            <div class="max-w-3xl">
              <button type="button" class="mb-3 block text-left text-sm text-gray-400" @click="toggleThought(pendingThoughtKey(message))">
                {{ pendingLabel(message) }}
              </button>
              <div v-if="expandedThoughtKey === pendingThoughtKey(message)" class="mb-4 max-w-md rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm dark:border-dark-800 dark:bg-dark-900">
                <div v-for="step in pendingThoughtSteps(message)" :key="step.label" class="flex gap-3 py-1.5">
                  <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gray-400 dark:bg-dark-500"></span>
                  <div>
                    <p class="font-medium text-gray-800 dark:text-dark-100">{{ step.label }}</p>
                    <p v-if="step.detail" class="mt-0.5 text-gray-500 dark:text-dark-400">{{ step.detail }}</p>
                  </div>
                </div>
              </div>
              <div v-if="message.images.length > 0" class="grid gap-4 sm:grid-cols-2">
                <figure v-for="(image, index) in message.images" :key="`${message.id}-${index}`" class="overflow-hidden rounded-[2rem] bg-gray-100 shadow-sm dark:bg-dark-800">
                  <img :src="image.url" :alt="`pending-image-${index + 1}`" class="aspect-square w-full object-cover" />
                </figure>
              </div>
            </div>
          </template>
        </main>
        <footer class="border-t border-gray-100 bg-white/95 px-4 py-3 backdrop-blur dark:border-dark-800 dark:bg-dark-950/95">
          <div class="mx-auto w-full max-w-3xl">
            <p v-if="unavailableMessage" class="mb-3 text-sm text-red-600 dark:text-red-400">{{ unavailableMessage }}</p>
            <p v-if="errorText" class="mb-3 text-sm text-red-600 dark:text-red-400">{{ errorText }}</p>
            <div class="ai-creation-composer">
              <input ref="fileInputEl" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="onUploadFile" />
              <textarea
                ref="promptEl"
                v-model="prompt"
                rows="1"
                class="max-h-36 min-h-20 w-full resize-none border-0 bg-transparent px-3 py-3 text-base text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
                :placeholder="selectedVersion ? '' : '输入你想生成的画面，也可以上传图片继续编辑'"
                :disabled="generating"
                @keydown.enter.exact.prevent="run"
              />
              <div class="ai-creation-actions">
                <AiModeTabs :model-value="activeMode" @update:model-value="emit('mode-change', $event)" />
                <div class="flex items-center justify-end gap-2">
                  <button type="button" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-800 hover:bg-gray-100 dark:text-dark-100 dark:hover:bg-dark-800" title="上传图片" @click="fileInputEl?.click()">
                    <Icon name="upload" size="sm" />
                  </button>
                  <button
                    :data-testid="isAdmin ? 'admin-generate-image' : 'generate-image'"
                    type="button"
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white disabled:cursor-not-allowed disabled:bg-gray-300 dark:bg-white dark:text-gray-900 dark:disabled:bg-dark-700"
                    :disabled="!canRun"
                    title="发送"
                    @click="run"
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
import { keysAPI, userChannelsAPI } from '@/api'
import { adminAPI } from '@/api/admin'
import {
  dataUrlToBlob,
  editImage,
  fetchImageVersionBlob,
  filterImageModels,
  generateImage,
  getImageProject,
  imageBillingTierForSize,
  IMAGE_SIZE_OPTIONS,
  listImageProjects,
  resolveKeyImageState,
  supportsImageWorkspaceModel,
  uploadImageVersion,
  DEFAULT_IMAGE_MODELS,
  deleteImageProject,
  type GeneratedImage,
  type ImageSizeOption,
  type ImageWorkspaceProjectDetail,
  type ImageWorkspaceProjectSummary,
  type ImageWorkspaceVersion,
} from '@/api/imageGeneration'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'
import {
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
} from '@/utils/aiCreationRecords'
import type { AdminGroup, ApiKey } from '@/types'

type WorkspaceScope = 'user' | 'admin'
type WorkspaceMode = 'generate' | 'edit' | 'upload'
type PendingMessageStatus = 'thinking' | 'saving' | 'failed'

interface ThoughtStep {
  label: string
  detail?: string
}

interface ThoughtRecord {
  seconds: number
  steps: ThoughtStep[]
}

interface PendingMessage {
  id: string
  projectId: number | null
  prompt: string
  action: WorkspaceMode
  status: PendingMessageStatus
  seconds: number
  sourceImages: GeneratedImage[]
  images: GeneratedImage[]
}

interface SaveContext {
  projectId: number | null
  sourceVersion: ImageWorkspaceVersion | null
}

const props = withDefaults(defineProps<{ scope: WorkspaceScope; activeMode?: AiCreationMode }>(), {
  activeMode: 'image',
})
const emit = defineEmits<{ 'mode-change': [value: AiCreationMode] }>()
const THOUGHT_STORAGE_KEY = 'sub2api:image-thoughts:v1'

const appStore = useAppStore()
const isAdmin = computed(() => props.scope === 'admin')

const groups = ref<AdminGroup[]>([])
const activeKeys = ref<ApiKey[]>([])
const models = ref<string[]>([])
const projects = ref<ImageWorkspaceProjectSummary[]>([])
const chatRecords = ref<AiCreationSidebarRecord[]>([])
const selectedDetail = ref<ImageWorkspaceProjectDetail | null>(null)
const selectedProjectId = ref<number | null>(null)
const selectedVersionId = ref<number | null>(null)
const selectedGroupId = ref<string | number | boolean | null>(null)
const selectedKeyValue = ref<string | number | boolean | null>(null)
const model = ref('')
const size = ref<ImageSizeOption>(IMAGE_SIZE_OPTIONS[0].value)
const prompt = ref('')
const uploadFile = ref<File | null>(null)
const uploadPreviewUrl = ref('')
const pendingMessages = ref<PendingMessage[]>([])
const versionObjectUrls = ref<Record<number, string>>({})
const versionLoadFailures = ref<Record<number, boolean>>({})
const versionThoughts = ref<Record<number, ThoughtRecord>>(readStoredThoughts())
const expandedThoughtKey = ref<string | null>(null)
const errorText = ref('')
const loading = ref(false)
const generating = ref(false)
const chatEl = ref<HTMLElement | null>(null)
const promptEl = ref<HTMLTextAreaElement | null>(null)
const fileInputEl = ref<HTMLInputElement | null>(null)
const deletingRecordId = ref('')
let controller: AbortController | null = null
let pendingTimer = 0
let keyLoadRequestId = 0

const selectedKey = computed(() => activeKeys.value.find((item) => item.key === selectedKeyValue.value) || null)
const selectedAdminGroup = computed<AdminGroup | null>(() => groups.value.find((item) => item.id === Number(selectedGroupId.value)) || null)
const selectedGroup = computed(() => isAdmin.value ? selectedAdminGroup.value : selectedKey.value?.group || null)
const keyState = computed(() => isAdmin.value ? { allowed: !!selectedKey.value, reason: null } : resolveKeyImageState(selectedGroup.value))
const selectedVersion = computed<ImageWorkspaceVersion | null>(() => selectedDetail.value?.versions.find((item) => item.id === selectedVersionId.value) || null)
const trimmedPrompt = computed(() => prompt.value.trim())
const groupOptions = computed(() => groups.value.map((item) => ({ value: item.id, label: item.name })))
const keyOptions = computed(() => activeKeys.value.map((item) => ({ value: item.key, label: apiKeyOptionLabel(item) })))
const modelOptions = computed(() => currentModels.value.map((item) => ({ value: item, label: item })))
const sizeOptions = computed(() => IMAGE_SIZE_OPTIONS.map((item) => ({
  ...item,
  label: imageSizeOptionLabel(item),
})))
const currentModels = computed<string[]>(() => {
  if (!isAdmin.value) return models.value
  const groupModels = selectedAdminGroup.value?.models_list_config?.models?.filter(Boolean) || []
  const supportedModels = groupModels.filter(supportsImageWorkspaceModel)
  return supportedModels.length > 0 ? supportedModels : [...DEFAULT_IMAGE_MODELS]
})
const chatItems = computed(() => (selectedDetail.value?.versions || []).map((version) => ({
  version,
  prompt: version.prompt || modeLabel(version.mode),
})))
const sidebarRecords = computed(() => sortAiCreationRecords([
  ...chatRecords.value,
  ...projects.value.map(imageProjectRecord),
]))
const visiblePendingMessages = computed(() => pendingMessages.value.filter((message) => message.projectId === selectedProjectId.value))
const effectiveMode = computed<WorkspaceMode>(() => {
  if (uploadFile.value) return 'upload'
  if (selectedVersion.value) return 'edit'
  return 'generate'
})
const uploadPromptEdit = computed(() => !!uploadFile.value && !!trimmedPrompt.value)
const unavailableMessage = computed(() => {
  if (effectiveMode.value === 'upload' && !uploadPromptEdit.value) return ''
  if (!selectedKey.value) return activeKeys.value.length === 0
    ? (isAdmin.value ? '没有可用 API 密钥' : '没有可用的 OpenAI 生图分组密钥')
    : ''
  if (keyState.value.reason === 'missing_group') return '当前密钥没有分组'
  if (keyState.value.reason === 'unsupported_platform') return '当前分组不是 OpenAI 平台'
  if (keyState.value.reason === 'image_disabled') return '当前分组未启用图片生成'
  if (keyState.value.reason === 'group_inactive') return '当前分组未启用'
  return ''
})
const canRun = computed(() => {
  if (generating.value) return false
  if (effectiveMode.value === 'upload') {
    if (!uploadPromptEdit.value) return !!uploadFile.value
    return !!selectedKey.value && !!keyState.value.allowed && !!model.value
  }
  if (!selectedKey.value || !keyState.value.allowed || !model.value || !trimmedPrompt.value) return false
  if (effectiveMode.value === 'edit') return !!selectedVersion.value
  return true
})
watch(groups, (items) => {
  if (!items.some((item) => item.id === Number(selectedGroupId.value))) selectedGroupId.value = items[0]?.id || null
})
watch(selectedGroupId, (groupId) => {
  if (isAdmin.value) void loadAdminKeys(Number(groupId))
})
watch(activeKeys, (items) => {
  if (!items.some((item) => item.key === selectedKeyValue.value)) selectedKeyValue.value = items[0]?.key || null
})
watch(currentModels, (items) => {
  if (!items.includes(model.value)) model.value = items[0] || ''
}, { immediate: true })
watch([chatItems, visiblePendingMessages, uploadPreviewUrl, generating], () => {
  void nextTick(() => chatEl.value?.scrollIntoView?.({ block: 'end' }))
})

watch(selectedDetail, (detail) => {
  void loadVersionImages(detail?.versions || [])
}, { immediate: true })

async function loadData() {
  loading.value = true
  chatRecords.value = readStoredChatConversations(props.scope).map(chatConversationRecord)
  try {
    if (isAdmin.value) {
      groups.value = (await adminAPI.groups.getAll('openai')).filter((item) => item.status === 'active' && item.allow_image_generation !== false)
    } else {
      const [keys, channels] = await Promise.all([
        keysAPI.list(1, 100, { status: 'active' }),
        userChannelsAPI.getAvailable(),
      ])
      activeKeys.value = keys.items.filter(isUserImageKeyAvailable)
      models.value = filterImageModels(channels.flatMap((channel) => channel.platforms.flatMap((platform) => platform.supported_models)))
    }
    await loadWorkspace()
  } catch (err: unknown) {
    appStore.showError(readErrorText(err))
  } finally {
    loading.value = false
  }
}

async function loadAdminKeys(groupId: number) {
  const requestId = ++keyLoadRequestId
  activeKeys.value = []
  if (!groupId) return
  try {
    const result = await adminAPI.groups.getGroupApiKeys(groupId, 1, 50)
    if (requestId !== keyLoadRequestId || groupId !== Number(selectedGroupId.value)) return
    activeKeys.value = ((result.items || []) as ApiKey[]).filter((item) => item.status === 'active')
  } catch (err: unknown) {
    if (requestId === keyLoadRequestId) appStore.showError(readErrorText(err))
  }
}

async function loadWorkspace() {
  const result = isAdmin.value
    ? await adminAPI.images.list({ page: 1, page_size: 50 })
    : await listImageProjects({ page: 1, page_size: 50 })
  projects.value = result.items
  if (!selectedProjectId.value || !projects.value.some((project) => project.id === selectedProjectId.value)) {
    selectedProjectId.value = preferredProjectId(projects.value)
  }
  if (selectedProjectId.value) await selectProject(selectedProjectId.value)
}

async function selectProject(id: number) {
  clearComposerDraft()
  selectedProjectId.value = id
  writeStoredImageProjectSelection(props.scope, id)
  selectedDetail.value = isAdmin.value ? await adminAPI.images.get(id) : await getImageProject(id)
  if (!selectedDetail.value!.versions.some((item) => item.id === selectedVersionId.value)) {
    selectedVersionId.value = selectedDetail.value!.versions.at(-1)?.id || null
  }
}

function startNewProject() {
  selectedProjectId.value = null
  selectedVersionId.value = null
  selectedDetail.value = null
  writeStoredImageProjectSelection(props.scope, null)
  pendingMessages.value = []
  expandedThoughtKey.value = null
  clearComposerDraft()
  void nextTick(() => promptEl.value?.focus())
}

function selectSidebarRecord(record: AiCreationSidebarRecord) {
  if (record.mode === 'dialogue' && record.conversationId) {
    writeStoredChatSelection(props.scope, record.conversationId)
    emit('mode-change', 'dialogue')
    return
  }
  if (record.projectId) void selectProject(record.projectId)
}

function canDeleteSidebarRecord(record: AiCreationSidebarRecord) {
  return (record.mode === 'dialogue' && !!record.conversationId) || (record.mode === 'image' && !!record.projectId)
}

function deleteSidebarRecordTitle(record: AiCreationSidebarRecord) {
  return record.mode === 'image' ? '删除作画记录' : '删除对话'
}

async function deleteSidebarRecord(record: AiCreationSidebarRecord) {
  if (record.mode === 'dialogue' && record.conversationId) {
    deleteChatConversationRecord(record.conversationId)
    return
  }
  if (record.mode === 'image' && record.projectId) {
    await deleteImageProjectRecord(record.projectId, record.id)
  }
}

function deleteChatConversationRecord(conversationId: string) {
  const conversations = readStoredChatConversations(props.scope).filter((item) => item.id !== conversationId)
  writeStoredChatConversations(props.scope, conversations)
  chatRecords.value = conversations.map(chatConversationRecord)
  if (readStoredChatSelection(props.scope) === conversationId) {
    writeStoredChatSelection(props.scope, conversations[0]?.id || null)
  }
}

async function deleteImageProjectRecord(projectId: number, recordId: string) {
  if (deletingRecordId.value) return
  deletingRecordId.value = recordId
  try {
    if (isAdmin.value) await adminAPI.images.delete(projectId)
    else await deleteImageProject(projectId)
    const nextProjects = projects.value.filter((project) => project.id !== projectId)
    projects.value = nextProjects
    if (selectedProjectId.value === projectId) {
      selectedProjectId.value = null
      selectedVersionId.value = null
      selectedDetail.value = null
      pendingMessages.value = pendingMessages.value.filter((message) => message.projectId !== projectId)
      const nextProjectId = preferredProjectId(nextProjects)
      if (nextProjectId) await selectProject(nextProjectId)
      else writeStoredImageProjectSelection(props.scope, null)
    } else if (readStoredImageProjectSelection(props.scope) === projectId) {
      writeStoredImageProjectSelection(props.scope, nextProjects[0]?.id || null)
    }
    appStore.showSuccess?.('已删除')
  } catch (err: unknown) {
    appStore.showError(readErrorText(err))
  } finally {
    deletingRecordId.value = ''
  }
}

function selectVersionForEdit(versionId: number) {
  clearUploadFile()
  selectedVersionId.value = versionId
  prompt.value = ''
  expandedThoughtKey.value = null
  void nextTick(() => promptEl.value?.focus())
}

function buildEditPrompt(value: string) {
  return [
    '基于提供的原图做编辑，保持原图主体、构图、轮廓、画布比例、背景和图标风格不变。',
    '只修改用户要求的内容；除非用户明确要求，否则不要新增人物、场景、文字或无关元素，也不要重画成新图。',
    `用户要求：${value}`,
  ].join('\n')
}

async function run() {
  if (!canRun.value) return
  const action = effectiveMode.value
  const saveContext: SaveContext = {
    projectId: selectedProjectId.value,
    sourceVersion: selectedVersion.value,
  }
  const uploadSource = uploadFile.value
  const editUploadedImage = action === 'upload' && !!uploadSource && !!trimmedPrompt.value
  const promptText = trimmedPrompt.value || uploadSource?.name || ''
  const uploadSourceImages = uploadSource && uploadPreviewUrl.value
    ? [{ url: uploadPreviewUrl.value, mimeType: uploadSource.type }]
    : []
  const pending = addPendingMessage(promptText, editUploadedImage ? 'edit' : action, saveContext.projectId, uploadSourceImages)
  prompt.value = ''
  if (uploadSource) clearUploadFile({ revoke: false })
  generating.value = true
  startPendingTimer()
  controller?.abort()
  controller = new AbortController()
  try {
    errorText.value = ''
    if (editUploadedImage) {
      const result = await editImage(selectedKey.value!.key, {
        model: model.value,
        prompt: promptText,
        image: uploadSource,
        size: size.value,
        n: 1,
        response_format: 'b64_json',
      }, { signal: controller.signal })
      finishThinking(pending, result.images)
      await saveImages(result.images, 'edit', promptText, pending, saveContext, false)
    } else if (action === 'upload') {
      await saveBlob(uploadSource!, 'upload', promptText, pending, saveContext)
    } else if (action === 'generate') {
      const result = await generateImage(selectedKey.value!.key, {
        model: model.value,
        prompt: promptText,
        size: size.value,
        n: 1,
        response_format: 'b64_json',
      }, { signal: controller.signal })
      finishThinking(pending, result.images)
      await saveImages(result.images, 'generation', promptText, pending, saveContext)
    } else {
      const source = await fetchVersionBlob(saveContext.sourceVersion!)
      const result = await editImage(selectedKey.value!.key, {
        model: model.value,
        prompt: buildEditPrompt(promptText),
        image: source,
        size: size.value,
        n: 1,
        response_format: 'b64_json',
      }, { signal: controller.signal })
      finishThinking(pending, result.images)
      await saveImages(result.images, 'edit', promptText, pending, saveContext)
    }
    removePendingMessage(pending.id)
    appStore.showSuccess?.('图片已保存')
  } catch (err: unknown) {
    if ((err as Error)?.name !== 'AbortError') {
      const message = readErrorText(err)
      settleFailedPending(pending.id)
      errorText.value = message
      appStore.showError(message)
    }
  } finally {
    generating.value = false
    stopPendingTimer()
    controller = null
  }
}

async function saveImages(images: GeneratedImage[], savedMode: 'generation' | 'edit', promptText: string, pending: PendingMessage, saveContext: SaveContext, linkSelectedVersion = true) {
  for (const image of images) {
    const blob = image.url.startsWith('data:') ? dataUrlToBlob(image.url) : await fetch(image.url).then((res) => res.blob())
    await saveBlob(blob, savedMode, promptText, pending, saveContext, linkSelectedVersion)
  }
}

async function saveBlob(blob: Blob, savedMode: 'generation' | 'edit' | 'upload', promptText: string, pending: PendingMessage, saveContext: SaveContext, linkSelectedVersion = true) {
  const form = new FormData()
  form.append('image', blob, 'image.png')
  form.append('mode', savedMode)
  form.append('prompt', promptText)
  form.append('model', model.value)
  form.append('size', size.value)
  if (saveContext.projectId) form.append('project_id', String(saveContext.projectId))
  if (linkSelectedVersion && saveContext.sourceVersion && savedMode !== 'generation' && savedMode !== 'upload') {
    form.append('parent_version_id', String(saveContext.sourceVersion.id))
    form.append('source_version_id', String(saveContext.sourceVersion.id))
  }
  const detail = await uploadImageVersion(form)
  const showSavedDetail = shouldShowSavedDetail(saveContext)
  const savedVersion = detail.versions.at(-1)
  if (showSavedDetail && savedVersion) setVersionImageBlob(savedVersion, blob)
  if (savedVersion) {
    saveThoughtRecord(savedVersion.id, buildThoughtRecord(pending, savedVersion, savedMode))
  }
  if (showSavedDetail) {
    selectedProjectId.value = detail.project.id
    writeStoredImageProjectSelection(props.scope, detail.project.id)
    selectedDetail.value = detail
    selectedVersionId.value = detail.versions.at(-1)?.id || null
  }
  const result = isAdmin.value
    ? await adminAPI.images.list({ page: 1, page_size: 50 })
    : await listImageProjects({ page: 1, page_size: 50 })
  projects.value = result.items
}

function onUploadFile(event: Event) {
  setUploadFile((event.target as HTMLInputElement).files?.[0] || null)
}

function versionSrc(version: ImageWorkspaceVersion) {
  return versionObjectUrls.value[version.id] || ''
}

function versionLoadLabel(version: ImageWorkspaceVersion) {
  return versionLoadFailures.value[version.id] ? '图片加载失败' : '图片加载中'
}

function markVersionImageFailed(version: ImageWorkspaceVersion) {
  const currentUrl = versionObjectUrls.value[version.id]
  if (currentUrl?.startsWith('blob:')) URL.revokeObjectURL(currentUrl)
  const nextUrls = { ...versionObjectUrls.value }
  delete nextUrls[version.id]
  versionObjectUrls.value = nextUrls
  versionLoadFailures.value = { ...versionLoadFailures.value, [version.id]: true }
}

function setVersionImageBlob(version: ImageWorkspaceVersion, blob: Blob) {
  if (blob.type && !blob.type.startsWith('image/')) return
  const currentUrl = versionObjectUrls.value[version.id]
  if (currentUrl?.startsWith('blob:')) URL.revokeObjectURL(currentUrl)
  versionObjectUrls.value = {
    ...versionObjectUrls.value,
    [version.id]: URL.createObjectURL(blob),
  }
  versionLoadFailures.value = { ...versionLoadFailures.value, [version.id]: false }
}

function markVersionImageLoaded(version: ImageWorkspaceVersion) {
  if (versionLoadFailures.value[version.id]) {
    versionLoadFailures.value = { ...versionLoadFailures.value, [version.id]: false }
  }
}

function modeLabel(value: string) {
  if (value === 'edit') return '编辑图片'
  if (value === 'mask' || value === 'mask_edit') return '局部编辑图片'
  if (value === 'upload') return '上传图片'
  return '生成图片'
}

function preferredProjectId(items: ImageWorkspaceProjectSummary[]) {
  const storedId = readStoredImageProjectSelection(props.scope)
  if (storedId && items.some((project) => project.id === storedId)) return storedId
  return items.find((project) => project.version_count > 0)?.id || items[0]?.id || null
}

function addPendingMessage(promptText: string, action: WorkspaceMode, projectId: number | null, sourceImages: GeneratedImage[] = []) {
  const message = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    projectId,
    prompt: promptText || modeLabel(action),
    action,
    status: action === 'upload' ? 'saving' : 'thinking',
    seconds: 0,
    sourceImages,
    images: [] as GeneratedImage[],
  } satisfies PendingMessage
  pendingMessages.value.push(message)
  return message
}

function removePendingMessage(id: string) {
  const message = pendingMessages.value.find((item) => item.id === id)
  message?.sourceImages.forEach(revokeGeneratedImageUrl)
  message?.images.forEach(revokeGeneratedImageUrl)
  pendingMessages.value = pendingMessages.value.filter((item) => item.id !== id)
}

function settleFailedPending(id: string) {
  const message = pendingMessages.value.find((item) => item.id === id)
  if (!message) return
  if (message.images.length === 0 && message.sourceImages.length === 0) {
    removePendingMessage(id)
    return
  }
  pendingMessages.value = pendingMessages.value.map((item) => item.id === id
    ? { ...item, status: 'failed' }
    : item)
}

function finishThinking(message: PendingMessage, images: GeneratedImage[]) {
  pendingMessages.value = pendingMessages.value.map((item) => item.id === message.id
    ? { ...item, status: 'saving', images }
    : item)
}

function setUploadFile(file: File | null) {
  clearUploadFile()
  uploadFile.value = file
  uploadPreviewUrl.value = file ? URL.createObjectURL(file) : ''
}

function clearUploadFile(options: { revoke?: boolean } = {}) {
  const shouldRevoke = options.revoke !== false
  if (shouldRevoke && uploadPreviewUrl.value) URL.revokeObjectURL(uploadPreviewUrl.value)
  uploadFile.value = null
  uploadPreviewUrl.value = ''
  if (fileInputEl.value) fileInputEl.value.value = ''
}

function revokeGeneratedImageUrl(image: GeneratedImage) {
  if (image.url.startsWith('blob:')) URL.revokeObjectURL(image.url)
}

function clearComposerDraft() {
  clearUploadFile()
  prompt.value = ''
  expandedThoughtKey.value = null
  errorText.value = ''
}

function shouldShowSavedDetail(saveContext: SaveContext) {
  return selectedProjectId.value === saveContext.projectId
}

function startPendingTimer() {
  stopPendingTimer()
  pendingTimer = window.setInterval(() => {
    pendingMessages.value.forEach((message) => {
      if (message.status === 'thinking') message.seconds += 1
    })
  }, 1000)
}

function stopPendingTimer() {
  if (pendingTimer) window.clearInterval(pendingTimer)
  pendingTimer = 0
}

function pendingLabel(message: PendingMessage) {
  if (message.status === 'failed') return '保存失败 ›'
  if (message.action === 'upload') return '上传图片 ›'
  return `Thought for ${message.seconds}s ›`
}

function versionThoughtKey(version: ImageWorkspaceVersion) {
  return `version-${version.id}`
}

function pendingThoughtKey(message: PendingMessage) {
  return `pending-${message.id}`
}

function toggleThought(key: string) {
  expandedThoughtKey.value = expandedThoughtKey.value === key ? null : key
}

function versionThoughtLabel(version: ImageWorkspaceVersion) {
  if (version.mode === 'upload') return 'Uploaded image ›'
  const thought = versionThoughts.value[version.id]
  return thought ? `Thought for ${thought.seconds}s ›` : 'Thought ›'
}

function versionThoughtSteps(version: ImageWorkspaceVersion): ThoughtStep[] {
  const thought = versionThoughts.value[version.id]
  if (thought) return thought.steps
  return [
    { label: '收到提示', detail: version.prompt || modeLabel(version.mode) },
    { label: modeLabel(version.mode), detail: [version.model, sizeLabel(version.size)].filter(Boolean).join(' · ') },
    { label: '结果已保存', detail: `image-${version.id}` },
  ]
}

function pendingThoughtSteps(message: PendingMessage): ThoughtStep[] {
  const steps: ThoughtStep[] = [
    { label: '收到提示', detail: message.prompt },
    { label: message.action === 'upload' ? '上传图片' : modeLabel(message.action), detail: [model.value, sizeLabel(size.value)].filter(Boolean).join(' · ') },
  ]
  steps.push({ label: message.status === 'thinking' ? '正在生成图片' : message.status === 'failed' ? '保存失败' : '正在保存结果' })
  return steps
}

function buildThoughtRecord(message: PendingMessage, version: ImageWorkspaceVersion, savedMode: 'generation' | 'edit' | 'upload'): ThoughtRecord {
  return {
    seconds: message.seconds,
    steps: [
      { label: '收到提示', detail: message.prompt },
      { label: modeLabel(savedMode), detail: [version.model || model.value, sizeLabel(version.size || size.value)].filter(Boolean).join(' · ') },
      { label: '结果已保存', detail: `image-${version.id}` },
    ],
  }
}

function saveThoughtRecord(versionId: number, record: ThoughtRecord) {
  versionThoughts.value = {
    ...versionThoughts.value,
    [versionId]: record,
  }
  try {
    localStorage.setItem(THOUGHT_STORAGE_KEY, JSON.stringify(versionThoughts.value))
  } catch {
    // Thought details are optional UI state.
  }
}

function readStoredThoughts(): Record<number, ThoughtRecord> {
  try {
    const parsed = JSON.parse(localStorage.getItem(THOUGHT_STORAGE_KEY) || '{}') as Record<string, ThoughtRecord>
    return Object.fromEntries(Object.entries(parsed).filter(([, record]) => isThoughtRecord(record)).map(([id, record]) => [Number(id), record]))
  } catch {
    return {}
  }
}

function isThoughtRecord(value: unknown): value is ThoughtRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as ThoughtRecord
  return Number.isFinite(record.seconds) && Array.isArray(record.steps)
}

function sizeLabel(value: string) {
  return IMAGE_SIZE_OPTIONS.find((item) => item.value === value)?.label || value
}

function imageSizeOptionLabel(option: (typeof IMAGE_SIZE_OPTIONS)[number]) {
  const price = imageSizePrice(option.value)
  return price === null ? option.label : `${option.label} · ${formatImagePrice(price)}`
}

function apiKeyOptionLabel(key: ApiKey) {
  return key.group?.name ? `${key.name} · ${key.group.name}` : key.name
}

function isUserImageKeyAvailable(key: ApiKey) {
  return key.status === 'active' && resolveKeyImageState(key.group).allowed
}

function imageSizePrice(value: ImageSizeOption) {
  const group = selectedGroup.value
  if (!group) return null
  const tier = imageBillingTierForSize(value)
  const basePrice = tier === '1K'
    ? group.image_price_1k
    : tier === '2K'
      ? group.image_price_2k
      : tier === '4K'
        ? group.image_price_4k
        : null
  if (basePrice === null || basePrice === undefined) return null
  const multiplier = group.image_rate_independent ? group.image_rate_multiplier : group.rate_multiplier
  const price = Number(basePrice) * (Number.isFinite(Number(multiplier)) ? Number(multiplier) : 1)
  return Number.isFinite(price) && price >= 0 ? price : null
}

function formatImagePrice(value: number) {
  return `$${value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')}`
}

async function loadVersionImages(versions: ImageWorkspaceVersion[]) {
  const ids = new Set(versions.map((version) => version.id))
  Object.entries(versionObjectUrls.value).forEach(([rawId, url]) => {
    if (!ids.has(Number(rawId))) {
      URL.revokeObjectURL(url)
      delete versionObjectUrls.value[Number(rawId)]
      delete versionLoadFailures.value[Number(rawId)]
    }
  })
  await Promise.all(versions.map(async (version) => {
    if (versionObjectUrls.value[version.id]) return
    versionLoadFailures.value = { ...versionLoadFailures.value, [version.id]: false }
    try {
      const blob = await fetchVersionBlob(version)
      if (blob.type && !blob.type.startsWith('image/')) {
        throw new Error(`invalid image response type: ${blob.type}`)
      }
      versionObjectUrls.value = {
        ...versionObjectUrls.value,
        [version.id]: URL.createObjectURL(blob),
      }
      versionLoadFailures.value = { ...versionLoadFailures.value, [version.id]: false }
    } catch {
      versionLoadFailures.value = { ...versionLoadFailures.value, [version.id]: true }
    }
  }))
}

function isSidebarRecordActive(record: AiCreationSidebarRecord) {
  return record.mode === 'image' && record.projectId === selectedProjectId.value
}

async function fetchVersionBlob(version: ImageWorkspaceVersion) {
  return fetchImageVersionBlob(version.id, isAdmin.value)
}

function readErrorText(err: unknown): string {
  if (err instanceof Error) return extractApiErrorMessage(err, err.message)
  return typeof err === 'string' ? err : '操作失败'
}

onMounted(loadData)
onBeforeUnmount(() => {
  stopPendingTimer()
  clearUploadFile()
  Object.values(versionObjectUrls.value).forEach((url) => URL.revokeObjectURL(url))
  pendingMessages.value.forEach((message) => {
    message.sourceImages.forEach(revokeGeneratedImageUrl)
    message.images.forEach(revokeGeneratedImageUrl)
  })
})
</script>

<style scoped>
.image-control-field {
  @apply flex min-w-0 flex-col gap-1;
}

.image-control-label {
  @apply text-xs font-medium text-gray-500 dark:text-dark-400;
}

.image-control-select :deep(.select-trigger) {
  @apply h-9 rounded-lg px-3 py-1.5 text-sm;
}

.image-control-select :deep(.select-icon svg) {
  @apply h-4 w-4;
}

.ai-creation-composer {
  @apply rounded-[1.75rem] border border-gray-200 bg-white p-2 shadow-xl shadow-gray-200/70 dark:border-dark-700 dark:bg-dark-900 dark:shadow-black/20;
}

.ai-creation-actions {
  @apply flex flex-col gap-2 border-t border-gray-100 px-1 pt-2 dark:border-dark-800 sm:flex-row sm:items-center sm:justify-between;
}
</style>
