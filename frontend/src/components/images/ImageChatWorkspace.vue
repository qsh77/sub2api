<template>
  <AppLayout>
    <div class="flex min-h-[calc(100vh-4rem)] flex-col bg-white dark:bg-dark-950">
      <div class="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-5 sm:px-6 lg:px-8">
        <header class="sticky top-16 z-20 -mx-4 border-b border-gray-100 bg-white/95 px-4 pb-4 backdrop-blur dark:border-dark-800 dark:bg-dark-950/95 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 class="text-xl font-semibold text-gray-900 dark:text-white">{{ title }}</h1>
              <p class="mt-1 text-sm text-gray-500 dark:text-dark-400">{{ subtitle }}</p>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" class="btn btn-secondary" :disabled="loading" @click="startNewProject">
                新对话
              </button>
            </div>
          </div>

          <div class="mt-4 grid gap-3 lg:grid-cols-[minmax(150px,1fr)_minmax(160px,1fr)_minmax(160px,1fr)_110px]">
            <Select
              v-if="isAdmin"
              v-model="selectedGroupId"
              :options="groupOptions"
              :disabled="loading || generating || groups.length === 0"
              placeholder="选择分组"
            />
            <Select
              v-model="selectedKeyValue"
              :options="keyOptions"
              :disabled="loading || generating || activeKeys.length === 0"
              placeholder="选择 API 密钥"
            />
            <Select v-model="model" :options="modelOptions" :disabled="generating" />
            <Select v-model="size" :options="sizeOptions" :disabled="generating" />
          </div>

          <div class="mt-3 flex flex-wrap items-center gap-2">
            <button
              v-for="project in projects"
              :key="project.id"
              type="button"
              class="rounded-full border px-3 py-1 text-xs transition"
              :class="project.id === selectedProjectId ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-dark-700 dark:text-dark-300 dark:hover:bg-dark-800'"
              @click="selectProject(project.id)"
            >
              {{ project.title || '未命名图片' }}
            </button>
          </div>
        </header>

        <main ref="chatEl" class="flex-1 space-y-8 py-8 pb-36">
          <div v-if="chatItems.length === 0 && transientImages.length === 0 && !generating" class="flex min-h-[45vh] items-center justify-center text-center">
            <div class="max-w-md">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">想生成什么图片？</h2>
              <p class="mt-2 text-sm text-gray-500 dark:text-dark-400">直接输入一句话。生成后可以继续点图片上的编辑或局部编辑。</p>
            </div>
          </div>

          <template v-for="item in chatItems" :key="item.version.id">
            <div class="flex justify-end">
              <div class="max-w-[82%] rounded-[1.5rem] bg-gray-900 px-5 py-3 text-sm leading-6 text-white shadow-sm">
                {{ item.prompt }}
              </div>
            </div>

            <div class="max-w-3xl">
              <button type="button" class="mb-3 text-left text-sm text-gray-400" @click="selectedVersionId = item.version.id">
                {{ item.thought }}
              </button>
              <figure class="group relative inline-block overflow-hidden rounded-[2rem] bg-gray-100 shadow-sm dark:bg-dark-800">
                <img
                  :src="versionUrl(item.version)"
                  :alt="`generated-image-${item.version.id}`"
                  class="max-h-[640px] w-full max-w-[720px] object-contain"
                  @click="selectVersionForFollowUp(item.version.id)"
                />
                <div class="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-4">
                  <button type="button" class="rounded-full bg-black/55 px-4 py-2 text-sm font-medium text-white backdrop-blur" @click="selectVersionForFollowUp(item.version.id)">
                    继续改
                  </button>
                  <div class="flex items-center gap-2">
                    <button type="button" class="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur" title="画局部区域" @click="openMaskEditor(item.version.id)">
                      ◌
                    </button>
                    <a class="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur" title="下载" :href="versionUrl(item.version)" :download="`image-${item.version.id}.png`">
                      ⇩
                    </a>
                    <button type="button" class="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur" title="删除" @click="deleteVersion(item.version.id)">
                      ×
                    </button>
                  </div>
                </div>
              </figure>
            </div>
          </template>

          <div v-if="transientImages.length > 0" class="max-w-3xl">
            <button type="button" class="mb-3 text-left text-sm text-gray-400">正在保存结果</button>
            <div class="grid gap-4 sm:grid-cols-2">
              <figure v-for="(image, index) in transientImages" :key="`${image.url}-${index}`" class="overflow-hidden rounded-[2rem] bg-gray-100 shadow-sm dark:bg-dark-800">
                <img :src="image.url" :alt="`generated-image-${index + 1}`" class="aspect-square w-full object-cover" />
              </figure>
            </div>
          </div>

          <div v-if="generating" class="max-w-3xl">
            <button type="button" class="text-left text-sm text-gray-400">Thought for {{ thinkingSeconds }}s ›</button>
          </div>
        </main>
      </div>

      <footer class="sticky bottom-0 z-30 border-t border-gray-100 bg-white/95 px-4 py-4 backdrop-blur dark:border-dark-800 dark:bg-dark-950/95">
        <div class="mx-auto w-full max-w-6xl">
          <div v-if="maskEditorOpen && selectedVersion" class="mb-4 max-w-2xl rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-dark-700 dark:bg-dark-900">
            <MaskEditor :src="selectedImageUrl" @update:mask-blob="maskBlob = $event" />
          </div>

          <p v-if="unavailableMessage" class="mb-3 text-sm text-red-600 dark:text-red-400">{{ unavailableMessage }}</p>
          <p v-if="errorText" class="mb-3 text-sm text-red-600 dark:text-red-400">{{ errorText }}</p>
          <p v-if="uploadFile" class="mb-3 text-sm text-gray-500 dark:text-dark-400">待上传：{{ uploadFile.name }}</p>

          <div class="flex items-end gap-3 rounded-[2rem] border border-gray-200 bg-white p-3 shadow-lg dark:border-dark-700 dark:bg-dark-900">
            <input ref="fileInputEl" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="onUploadFile" />
            <button type="button" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl text-gray-800 hover:bg-gray-100 dark:text-dark-100 dark:hover:bg-dark-800" @click="fileInputEl?.click()">
              +
            </button>
            <textarea
              ref="promptEl"
              v-model="prompt"
              rows="1"
              class="max-h-40 min-h-11 flex-1 resize-none border-0 bg-transparent px-1 py-2 text-base text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
              :placeholder="composerPlaceholder"
              :disabled="generating"
              @keydown.enter.exact.prevent="run"
            />
            <button
              :data-testid="isAdmin ? 'admin-generate-image' : 'generate-image'"
              type="button"
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white disabled:cursor-not-allowed disabled:bg-gray-300 dark:bg-white dark:text-gray-900 dark:disabled:bg-dark-700"
              :disabled="!canRun"
              @click="run"
            >
              ↑
            </button>
          </div>
        </div>
      </footer>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import Select from '@/components/common/Select.vue'
import MaskEditor from '@/components/images/MaskEditor.vue'
import { keysAPI, userChannelsAPI } from '@/api'
import { adminAPI } from '@/api/admin'
import {
  dataUrlToBlob,
  deleteImageVersion,
  editImage,
  filterImageModels,
  generateImage,
  getImageProject,
  imageVersionFileUrl,
  IMAGE_SIZE_OPTIONS,
  listImageProjects,
  resolveKeyImageState,
  uploadImageVersion,
  DEFAULT_IMAGE_MODELS,
  type GeneratedImage,
  type ImageSizeOption,
  type ImageWorkspaceProjectDetail,
  type ImageWorkspaceProjectSummary,
  type ImageWorkspaceVersion,
} from '@/api/imageGeneration'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'
import type { AdminGroup, ApiKey } from '@/types'

type WorkspaceScope = 'user' | 'admin'
type WorkspaceMode = 'generate' | 'edit' | 'mask' | 'upload'

const props = defineProps<{ scope: WorkspaceScope }>()

const appStore = useAppStore()
const isAdmin = computed(() => props.scope === 'admin')
const title = computed(() => isAdmin.value ? '图片生成' : '图片生成')
const subtitle = computed(() => isAdmin.value ? '对话式生成、编辑和管理图片' : '像聊天一样生成、修改和保存图片')

const groups = ref<AdminGroup[]>([])
const activeKeys = ref<ApiKey[]>([])
const models = ref<string[]>([])
const projects = ref<ImageWorkspaceProjectSummary[]>([])
const selectedDetail = ref<ImageWorkspaceProjectDetail | null>(null)
const selectedProjectId = ref<number | null>(null)
const selectedVersionId = ref<number | null>(null)
const selectedGroupId = ref<string | number | boolean | null>(null)
const selectedKeyValue = ref<string | number | boolean | null>(null)
const maskEditorOpen = ref(false)
const model = ref('')
const size = ref<ImageSizeOption>(IMAGE_SIZE_OPTIONS[0].value)
const prompt = ref('')
const uploadFile = ref<File | null>(null)
const maskBlob = ref<Blob | null>(null)
const transientImages = ref<GeneratedImage[]>([])
const errorText = ref('')
const loading = ref(false)
const generating = ref(false)
const thinkingSeconds = ref(0)
const chatEl = ref<HTMLElement | null>(null)
const promptEl = ref<HTMLTextAreaElement | null>(null)
const fileInputEl = ref<HTMLInputElement | null>(null)
let controller: AbortController | null = null
let thinkingTimer = 0
let keyLoadRequestId = 0

const selectedKey = computed(() => activeKeys.value.find((item) => item.key === selectedKeyValue.value) || null)
const selectedAdminGroup = computed<AdminGroup | null>(() => groups.value.find((item) => item.id === Number(selectedGroupId.value)) || null)
const selectedGroup = computed(() => isAdmin.value ? selectedAdminGroup.value : selectedKey.value?.group || null)
const keyState = computed(() => isAdmin.value ? { allowed: !!selectedKey.value, reason: null } : resolveKeyImageState(selectedGroup.value))
const selectedVersion = computed<ImageWorkspaceVersion | null>(() => selectedDetail.value?.versions.find((item) => item.id === selectedVersionId.value) || null)
const selectedImageUrl = computed(() => selectedVersion.value ? versionUrl(selectedVersion.value) : '')
const trimmedPrompt = computed(() => prompt.value.trim())
const groupOptions = computed(() => groups.value.map((item) => ({ value: item.id, label: item.name })))
const keyOptions = computed(() => activeKeys.value.map((item) => ({ value: item.key, label: item.name })))
const modelOptions = computed(() => currentModels.value.map((item) => ({ value: item, label: item })))
const sizeOptions = computed(() => IMAGE_SIZE_OPTIONS.map((item) => ({ ...item })))
const currentModels = computed<string[]>(() => {
  if (!isAdmin.value) return models.value
  const groupModels = selectedAdminGroup.value?.models_list_config?.models?.filter(Boolean) || []
  return groupModels.length > 0 ? groupModels : [...DEFAULT_IMAGE_MODELS]
})
const chatItems = computed(() => (selectedDetail.value?.versions || []).map((version) => ({
  version,
  prompt: version.prompt || modeLabel(version.mode),
  thought: version.mode === 'upload' ? 'Uploaded image' : 'Thought ›',
})))
const effectiveMode = computed<WorkspaceMode>(() => {
  if (uploadFile.value) return 'upload'
  if (selectedVersion.value && maskBlob.value) return 'mask'
  if (selectedVersion.value) return 'edit'
  return 'generate'
})
const unavailableMessage = computed(() => {
  if (effectiveMode.value === 'upload') return ''
  if (!selectedKey.value) return activeKeys.value.length === 0 ? '没有可用 API 密钥' : ''
  if (keyState.value.reason === 'missing_group') return '当前密钥没有分组'
  if (keyState.value.reason === 'unsupported_platform') return '当前分组不是 OpenAI 平台'
  if (keyState.value.reason === 'image_disabled') return '当前分组未启用图片生成'
  if (keyState.value.reason === 'group_inactive') return '当前分组未启用'
  return ''
})
const canRun = computed(() => {
  if (generating.value) return false
  if (effectiveMode.value === 'upload') return !!uploadFile.value
  if (!selectedKey.value || !keyState.value.allowed || !model.value || !trimmedPrompt.value) return false
  if (effectiveMode.value === 'edit') return !!selectedVersion.value
  if (effectiveMode.value === 'mask') return !!selectedVersion.value && !!maskBlob.value
  return true
})
const composerPlaceholder = computed(() => {
  if (effectiveMode.value === 'edit') return '直接说要怎么修改这张图'
  if (effectiveMode.value === 'mask') return '描述画出的局部区域要怎么改'
  if (effectiveMode.value === 'upload') return '上传后可补充一句说明'
  return '有问题，尽管问'
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
watch([chatItems, transientImages, generating], () => {
  void nextTick(() => chatEl.value?.scrollIntoView?.({ block: 'end' }))
})

async function loadData() {
  loading.value = true
  try {
    if (isAdmin.value) {
      groups.value = (await adminAPI.groups.getAll('openai')).filter((item) => item.status === 'active' && item.allow_image_generation !== false)
    } else {
      const [keys, channels] = await Promise.all([
        keysAPI.list(1, 100, { status: 'active' }),
        userChannelsAPI.getAvailable(),
      ])
      activeKeys.value = keys.items.filter((item) => item.status === 'active')
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
  if (!selectedProjectId.value && projects.value[0]) selectedProjectId.value = projects.value[0].id
  if (selectedProjectId.value) await selectProject(selectedProjectId.value)
}

async function selectProject(id: number) {
  selectedProjectId.value = id
  selectedDetail.value = isAdmin.value ? await adminAPI.images.get(id) : await getImageProject(id)
  if (!selectedDetail.value.versions.some((item) => item.id === selectedVersionId.value)) {
    selectedVersionId.value = selectedDetail.value.versions.at(-1)?.id || null
  }
}

function startNewProject() {
  selectedProjectId.value = null
  selectedVersionId.value = null
  selectedDetail.value = null
  transientImages.value = []
  uploadFile.value = null
  maskBlob.value = null
  maskEditorOpen.value = false
  prompt.value = ''
  void nextTick(() => promptEl.value?.focus())
}

function selectVersionForFollowUp(versionId: number) {
  selectedVersionId.value = versionId
  prompt.value = ''
  maskBlob.value = null
  maskEditorOpen.value = false
  void nextTick(() => promptEl.value?.focus())
}

function openMaskEditor(versionId: number) {
  selectedVersionId.value = versionId
  prompt.value = ''
  maskBlob.value = null
  maskEditorOpen.value = true
  void nextTick(() => promptEl.value?.focus())
}

async function run() {
  if (!canRun.value) return
  generating.value = true
  transientImages.value = []
  startThinking()
  controller?.abort()
  controller = new AbortController()
  const action = effectiveMode.value
  try {
    errorText.value = ''
    if (action === 'upload') {
      await saveBlob(uploadFile.value!, 'upload')
      uploadFile.value = null
    } else if (action === 'generate') {
      const result = await generateImage(selectedKey.value!.key, {
        model: model.value,
        prompt: trimmedPrompt.value,
        size: size.value,
        n: 1,
        response_format: 'b64_json',
      }, { signal: controller.signal })
      transientImages.value = result.images
      await saveImages(result.images, 'generation')
    } else {
      const source = await fetch(selectedImageUrl.value).then((res) => res.blob())
      const result = await editImage(selectedKey.value!.key, {
        model: model.value,
        prompt: trimmedPrompt.value,
        image: source,
        mask: action === 'mask' ? maskBlob.value : null,
        size: size.value,
        n: 1,
        response_format: 'b64_json',
      }, { signal: controller.signal })
      transientImages.value = result.images
      await saveImages(result.images, action === 'mask' ? 'mask_edit' : 'edit')
    }
    prompt.value = ''
    maskBlob.value = null
    maskEditorOpen.value = false
    appStore.showSuccess?.('图片已保存')
  } catch (err: unknown) {
    if ((err as Error)?.name !== 'AbortError') {
      const message = readErrorText(err)
      errorText.value = message
      appStore.showError(message)
    }
  } finally {
    generating.value = false
    transientImages.value = []
    stopThinking()
    controller = null
  }
}

async function saveImages(images: GeneratedImage[], savedMode: 'generation' | 'edit' | 'mask_edit') {
  for (const image of images) {
    const blob = image.url.startsWith('data:') ? dataUrlToBlob(image.url) : await fetch(image.url).then((res) => res.blob())
    await saveBlob(blob, savedMode)
  }
}

async function saveBlob(blob: Blob, savedMode: 'generation' | 'edit' | 'mask_edit' | 'upload') {
  const form = new FormData()
  form.append('image', blob, 'image.png')
  form.append('mode', savedMode)
  form.append('prompt', trimmedPrompt.value || uploadFile.value?.name || '')
  form.append('model', model.value)
  form.append('size', size.value)
  if (savedMode === 'mask_edit' && maskBlob.value) form.append('mask', maskBlob.value, 'mask.png')
  if (selectedProjectId.value) form.append('project_id', String(selectedProjectId.value))
  if (selectedVersion.value && savedMode !== 'generation' && savedMode !== 'upload') {
    form.append('parent_version_id', String(selectedVersion.value.id))
    form.append('source_version_id', String(selectedVersion.value.id))
  }
  const detail = await uploadImageVersion(form)
  selectedProjectId.value = detail.project.id
  selectedDetail.value = detail
  selectedVersionId.value = detail.versions.at(-1)?.id || null
  const result = isAdmin.value
    ? await adminAPI.images.list({ page: 1, page_size: 50 })
    : await listImageProjects({ page: 1, page_size: 50 })
  projects.value = result.items
}

function onUploadFile(event: Event) {
  uploadFile.value = (event.target as HTMLInputElement).files?.[0] || null
}

async function deleteVersion(id: number) {
  await deleteImageVersion(id)
  if (selectedProjectId.value) await selectProject(selectedProjectId.value)
}

function versionUrl(version: ImageWorkspaceVersion) {
  return imageVersionFileUrl(version.id, isAdmin.value)
}

function modeLabel(value: string) {
  if (value === 'edit') return '编辑图片'
  if (value === 'mask_edit') return '局部编辑图片'
  if (value === 'upload') return '上传图片'
  return '生成图片'
}

function startThinking() {
  stopThinking()
  thinkingSeconds.value = 0
  thinkingTimer = window.setInterval(() => {
    thinkingSeconds.value += 1
  }, 1000)
}

function stopThinking() {
  if (thinkingTimer) window.clearInterval(thinkingTimer)
  thinkingTimer = 0
}

function readErrorText(err: unknown): string {
  if (err instanceof Error) return extractApiErrorMessage(err, err.message)
  return typeof err === 'string' ? err : '操作失败'
}

onMounted(loadData)
onBeforeUnmount(() => {
  controller?.abort()
  stopThinking()
})
</script>
