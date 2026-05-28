<template>
  <AppLayout>
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div class="flex flex-col gap-1">
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
          {{ t('imageGeneration.title') }}
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('imageGeneration.subtitle') }}
        </p>
      </div>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <section class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-dark-700 dark:bg-dark-800">
          <div class="space-y-5">
            <label class="block">
              <span class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                {{ t('imageGeneration.apiKey') }}
              </span>
              <Select
                v-model="selectedKeyValue"
                :options="keyOptions"
                :disabled="loading || activeKeys.length === 0"
                :placeholder="t('imageGeneration.selectApiKey')"
              />
            </label>

            <div class="grid gap-3 rounded-lg bg-gray-50 p-4 text-sm dark:bg-dark-900/60">
              <div class="flex items-center justify-between gap-3">
                <span class="text-gray-500 dark:text-gray-400">{{ t('imageGeneration.group') }}</span>
                <span class="font-medium text-gray-900 dark:text-white">{{ selectedGroup?.name || '-' }}</span>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-gray-500 dark:text-gray-400">{{ t('imageGeneration.platform') }}</span>
                <span class="font-medium text-gray-900 dark:text-white">{{ selectedGroup?.platform || '-' }}</span>
              </div>
            </div>

            <p v-if="unavailableMessage" class="text-sm text-red-600 dark:text-red-400">
              {{ unavailableMessage }}
            </p>

            <label class="block">
              <span class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                {{ t('imageGeneration.model') }}
              </span>
              <Select v-model="model" :options="modelOptions" />
            </label>

            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block">
                <span class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  {{ t('imageGeneration.size') }}
                </span>
                <Select v-model="size" :options="sizeOptions" />
              </label>
              <label class="block">
                <span class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  {{ t('imageGeneration.count') }}
                </span>
                <input v-model.number="count" type="number" min="1" max="4" class="input" />
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
              />
            </label>

            <button
              data-testid="generate-image"
              type="button"
              class="btn btn-primary w-full"
              :disabled="!canGenerate"
              @click="submit"
            >
              {{ generating ? t('imageGeneration.generating') : t('imageGeneration.generate') }}
            </button>
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

          <div v-else class="grid gap-4 sm:grid-cols-2">
            <figure v-for="(image, index) in images" :key="`${image.url}-${index}`" class="space-y-3">
              <img
                :src="image.url"
                :alt="`generated-image-${index + 1}`"
                class="aspect-square w-full rounded-lg object-cover"
              />
              <a
                :href="imageToDownloadHref(image)"
                :download="`generated-image-${index + 1}.png`"
                class="btn btn-secondary w-full"
              >
                {{ t('imageGeneration.download') }}
              </a>
            </figure>
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
import { keysAPI, userChannelsAPI } from '@/api'
import {
  filterImageModels,
  generateImage,
  imageToDownloadHref,
  IMAGE_SIZE_OPTIONS,
  resolveKeyImageState,
  type GeneratedImage,
  type ImageSizeOption,
} from '@/api/imageGeneration'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'
import type { ApiKey } from '@/types'

const { t } = useI18n()
const appStore = useAppStore()

const activeKeys = ref<ApiKey[]>([])
const models = ref<string[]>([])
const selectedKeyValue = ref<string | number | boolean | null>(null)
const model = ref('')
const size = ref<ImageSizeOption>(IMAGE_SIZE_OPTIONS[0].value)
const count = ref(1)
const prompt = ref('')
const images = ref<GeneratedImage[]>([])
const loading = ref(false)
const generating = ref(false)
let controller: AbortController | null = null

const selectedKey = computed(() => activeKeys.value.find((item) => item.key === selectedKeyValue.value) || null)
const selectedGroup = computed(() => selectedKey.value?.group || null)
const keyState = computed(() => resolveKeyImageState(selectedGroup.value))
const trimmedPrompt = computed(() => prompt.value.trim())
const countValid = computed(() => Number.isInteger(count.value) && count.value >= 1 && count.value <= 4)

const keyOptions = computed(() => activeKeys.value.map((item) => ({ value: item.key, label: item.name })))
const modelOptions = computed(() => models.value.map((item) => ({ value: item, label: item })))
const sizeOptions = computed(() => IMAGE_SIZE_OPTIONS.map((item) => ({ ...item })))
const unavailableMessage = computed(() => {
  if (!selectedKey.value) return activeKeys.value.length === 0 ? t('imageGeneration.errors.noActiveKey') : ''
  if (keyState.value.reason === 'missing_group') return t('imageGeneration.errors.missingGroup')
  if (keyState.value.reason === 'unsupported_platform') return t('imageGeneration.errors.unsupportedPlatform')
  if (keyState.value.reason === 'image_disabled') return t('imageGeneration.errors.imageDisabled')
  if (keyState.value.reason === 'group_inactive') return t('imageGeneration.errors.groupInactive')
  return ''
})
const canGenerate = computed(
  () =>
    !!selectedKey.value &&
    keyState.value.allowed &&
    !!trimmedPrompt.value &&
    !generating.value &&
    countValid.value,
)

watch(activeKeys, (items) => {
  if (!items.some((item) => item.key === selectedKeyValue.value)) {
    selectedKeyValue.value = items[0]?.key || null
  }
})

watch(models, (items) => {
  if (!items.includes(model.value)) {
    model.value = items[0] || ''
  }
})

async function loadData() {
  loading.value = true
  try {
    const [keys, channels] = await Promise.all([
      keysAPI.list(1, 100, { status: 'active' }),
      userChannelsAPI.getAvailable(),
    ])
    activeKeys.value = keys.items.filter((item) => item.status === 'active')
    models.value = filterImageModels(
      channels.flatMap((channel) => channel.platforms.flatMap((platform) => platform.supported_models)),
    )
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t('common.error')))
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (!canGenerate.value || !selectedKey.value || !model.value) return

  controller?.abort()
  controller = new AbortController()
  generating.value = true
  try {
    const result = await generateImage(
      selectedKey.value.key,
      {
        model: model.value,
        prompt: trimmedPrompt.value,
        size: size.value,
        n: count.value,
        response_format: 'b64_json',
      },
      { signal: controller.signal },
    )
    images.value = result.images
    appStore.showSuccess(t('imageGeneration.success'))
  } catch (err: unknown) {
    if ((err as Error)?.name !== 'AbortError') {
      appStore.showError(extractApiErrorMessage(err, t('common.error')))
    }
  } finally {
    generating.value = false
    controller = null
  }
}

onMounted(loadData)
onBeforeUnmount(() => controller?.abort())
</script>
