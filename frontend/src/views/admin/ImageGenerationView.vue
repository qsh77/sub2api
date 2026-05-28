<template>
  <AppLayout>
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
          {{ t('imageGeneration.admin.title') }}
        </h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {{ t('imageGeneration.admin.subtitle') }}
        </p>
      </div>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <section class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-dark-700 dark:bg-dark-800">
          <div class="space-y-5">
            <label class="block">
              <span class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                {{ t('imageGeneration.admin.group') }}
              </span>
              <Select
                v-model="selectedGroupId"
                :options="groupOptions"
                :disabled="generating || loadingGroups || groups.length === 0"
                :placeholder="t('imageGeneration.admin.selectGroup')"
              />
            </label>

            <label class="block">
              <span class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                {{ t('imageGeneration.admin.apiKey') }}
              </span>
              <Select
                v-model="selectedKeyValue"
                :options="keyOptions"
                :disabled="generating || loadingKeys || activeKeys.length === 0"
                :placeholder="t('imageGeneration.admin.selectApiKey')"
              />
            </label>

            <label class="block">
              <span class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                {{ t('imageGeneration.model') }}
              </span>
              <Select v-model="model" :options="modelOptions" :disabled="generating" />
            </label>

            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block">
                <span class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  {{ t('imageGeneration.size') }}
                </span>
                <Select v-model="size" :options="sizeOptions" :disabled="generating" />
              </label>
              <label class="block">
                <span class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  {{ t('imageGeneration.count') }}
                </span>
                <input v-model.number="count" type="number" min="1" max="4" class="input" :disabled="generating" />
              </label>
            </div>

            <label class="block">
              <span class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                {{ t('imageGeneration.prompt') }}
              </span>
              <textarea
                v-model="prompt"
                rows="7"
                class="input min-h-40 resize-y"
                :placeholder="t('imageGeneration.promptPlaceholder')"
                :disabled="generating"
              />
            </label>

            <button
              data-testid="admin-generate-image"
              type="button"
              class="btn btn-primary w-full"
              :disabled="!canGenerate"
              @click="submit"
            >
              {{ generating ? t('imageGeneration.generating') : t('imageGeneration.generate') }}
            </button>

            <p v-if="errorText" class="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {{ errorText }}
            </p>
          </div>
        </section>

        <section class="min-h-[360px] rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-dark-700 dark:bg-dark-800">
          <div v-if="images.length === 0" class="flex h-full min-h-[320px] items-center justify-center text-center">
            <div class="max-w-sm">
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ t('imageGeneration.emptyTitle') }}
              </h2>
              <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {{ t('imageGeneration.emptyDescription') }}
              </p>
            </div>
          </div>

          <div v-else class="space-y-5">
            <div class="grid gap-4 sm:grid-cols-2">
              <figure v-for="(image, index) in images" :key="`${image.url}-${index}`" class="space-y-3">
                <img
                  :src="image.url"
                  :alt="`admin-generated-image-${index + 1}`"
                  class="aspect-square w-full rounded-lg object-cover"
                />
                <a
                  :href="imageToDownloadHref(image)"
                  :download="`admin-generated-image-${index + 1}.png`"
                  class="btn btn-secondary w-full"
                >
                  {{ t('imageGeneration.download') }}
                </a>
              </figure>
            </div>

            <div
              v-if="diagnostics"
              data-testid="admin-image-diagnostics"
              class="rounded-lg bg-gray-50 p-4 text-sm dark:bg-dark-900/60"
            >
              <h2 class="font-semibold text-gray-900 dark:text-white">
                {{ t('imageGeneration.admin.diagnostics') }}
              </h2>
              <dl class="mt-3 grid gap-2 text-gray-600 dark:text-gray-300">
                <div class="flex justify-between gap-4">
                  <dt>{{ t('imageGeneration.model') }}</dt>
                  <dd class="font-medium text-gray-900 dark:text-white">{{ diagnostics.model }}</dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt>{{ t('imageGeneration.admin.group') }}</dt>
                  <dd class="font-medium text-gray-900 dark:text-white">{{ diagnostics.groupName }}</dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt>{{ t('imageGeneration.admin.apiKey') }}</dt>
                  <dd class="font-medium text-gray-900 dark:text-white">{{ diagnostics.keyName }}</dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt>{{ t('imageGeneration.admin.duration') }}</dt>
                  <dd class="font-medium text-gray-900 dark:text-white">{{ diagnostics.durationMs }} ms</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import Select from '@/components/common/Select.vue'
import { adminAPI } from '@/api/admin'
import {
  DEFAULT_IMAGE_MODELS,
  generateImage,
  imageToDownloadHref,
  IMAGE_SIZE_OPTIONS,
  type GeneratedImage,
  type ImageSizeOption
} from '@/api/imageGeneration'
import { useAppStore } from '@/stores/app'
import type { AdminGroup, ApiKey } from '@/types'

interface Diagnostics {
  model: string
  groupName: string
  keyName: string
  durationMs: number
}

const { t } = useI18n()
const appStore = useAppStore()

const groups = ref<AdminGroup[]>([])
const activeKeys = ref<ApiKey[]>([])
const selectedGroupId = ref<string | number | boolean | null>(null)
const selectedKeyValue = ref<string | number | boolean | null>(null)
const model = ref('')
const size = ref<ImageSizeOption>(IMAGE_SIZE_OPTIONS[0].value)
const count = ref(1)
const prompt = ref('')
const images = ref<GeneratedImage[]>([])
const diagnostics = ref<Diagnostics | null>(null)
const errorText = ref('')
const loadingGroups = ref(false)
const loadingKeys = ref(false)
const generating = ref(false)
let controller: AbortController | null = null
let keyLoadRequestId = 0

const selectedGroup = computed(() => groups.value.find((item) => item.id === Number(selectedGroupId.value)) || null)
const selectedKey = computed(() => activeKeys.value.find((item) => item.key === selectedKeyValue.value) || null)
const trimmedPrompt = computed(() => prompt.value.trim())
const countValid = computed(() => Number.isInteger(count.value) && count.value >= 1 && count.value <= 4)
const groupOptions = computed(() => groups.value.map((item) => ({ value: item.id, label: item.name })))
const keyOptions = computed(() => activeKeys.value.map((item) => ({ value: item.key, label: item.name })))
const modelOptions = computed(() => currentModels.value.map((item) => ({ value: item, label: item })))
const sizeOptions = computed(() => IMAGE_SIZE_OPTIONS.map((item) => ({ ...item })))
const currentModels = computed(() => {
  const models = selectedGroup.value?.models_list_config?.models?.filter(Boolean) || []
  return models.length > 0 ? models : [...DEFAULT_IMAGE_MODELS]
})
const canGenerate = computed(
  () => !!selectedKey.value && !!model.value && !!trimmedPrompt.value && !generating.value && countValid.value
)

watch(groups, (items) => {
  if (!items.some((item) => item.id === Number(selectedGroupId.value))) {
    selectedGroupId.value = items[0]?.id || null
  }
})

watch(selectedGroupId, (groupId) => {
  void loadKeys(Number(groupId))
})

watch(activeKeys, (items) => {
  if (!items.some((item) => item.key === selectedKeyValue.value)) {
    selectedKeyValue.value = items[0]?.key || null
  }
})

watch(currentModels, (items) => {
  if (!items.includes(model.value)) {
    model.value = items[0] || ''
  }
}, { immediate: true })

async function loadGroups() {
  loadingGroups.value = true
  try {
    const items = await adminAPI.groups.getAll('openai')
    groups.value = items.filter((item) => item.status === 'active' && item.allow_image_generation !== false)
  } catch (err: unknown) {
    const message = readErrorText(err)
    errorText.value = message
    appStore.showError(message)
  } finally {
    loadingGroups.value = false
  }
}

async function loadKeys(groupId: number) {
  const requestId = ++keyLoadRequestId
  activeKeys.value = []
  if (!groupId) return

  loadingKeys.value = true
  try {
    const result = await adminAPI.groups.getGroupApiKeys(groupId, 1, 50)
    if (requestId !== keyLoadRequestId || groupId !== Number(selectedGroupId.value)) return
    activeKeys.value = ((result.items || []) as ApiKey[]).filter((item) => item.status === 'active')
  } catch (err: unknown) {
    if (requestId !== keyLoadRequestId || groupId !== Number(selectedGroupId.value)) return
    const message = readErrorText(err)
    errorText.value = message
    appStore.showError(message)
  } finally {
    if (requestId === keyLoadRequestId && groupId === Number(selectedGroupId.value)) {
      loadingKeys.value = false
    }
  }
}

async function submit() {
  if (!canGenerate.value || !selectedKey.value || !selectedGroup.value) return
  const snapshot = {
    key: selectedKey.value.key,
    keyName: selectedKey.value.name,
    groupId: selectedGroup.value.id,
    groupName: selectedGroup.value.name,
    model: model.value,
    size: size.value,
    n: count.value,
    prompt: trimmedPrompt.value
  }

  controller?.abort()
  controller = new AbortController()
  generating.value = true
  errorText.value = ''
  diagnostics.value = null
  const startedAt = Date.now()
  try {
    const result = await generateImage(
      snapshot.key,
      {
        model: snapshot.model,
        prompt: snapshot.prompt,
        size: snapshot.size,
        n: snapshot.n,
        response_format: 'b64_json'
      },
      { signal: controller.signal }
    )
    images.value = result.images
    diagnostics.value = {
      model: snapshot.model,
      groupName: snapshot.groupName,
      keyName: snapshot.keyName,
      durationMs: Math.max(0, Date.now() - startedAt)
    }
  } catch (err: unknown) {
    if ((err as Error)?.name !== 'AbortError') {
      const message = readErrorText(err)
      errorText.value = message
      appStore.showError(message)
    }
  } finally {
    generating.value = false
    controller = null
  }
}

function readErrorText(err: unknown): string {
  if (err instanceof Error) return err.message
  return typeof err === 'string' ? err : t('common.error')
}

onMounted(loadGroups)
onBeforeUnmount(() => controller?.abort())
</script>
