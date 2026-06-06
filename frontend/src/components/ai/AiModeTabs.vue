<template>
  <div data-testid="ai-mode-tabs" class="ai-mode-tabs" role="tablist" aria-label="AI creation mode">
    <button
      type="button"
      data-testid="ai-mode-dialogue"
      class="ai-mode-tab"
      :class="modelValue === 'dialogue' ? 'ai-mode-tab-active' : 'ai-mode-tab-idle'"
      role="tab"
      :aria-selected="modelValue === 'dialogue'"
      @click="$emit('update:modelValue', 'dialogue')"
    >
      <Icon name="chat" size="sm" />
      <span>对话</span>
    </button>
    <button
      type="button"
      data-testid="ai-mode-image"
      class="ai-mode-tab"
      :class="modelValue === 'image' ? 'ai-mode-tab-active' : 'ai-mode-tab-idle'"
      role="tab"
      :aria-selected="modelValue === 'image'"
      @click="$emit('update:modelValue', 'image')"
    >
      <Icon name="sparkles" size="sm" />
      <span>作画</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import Icon from '@/components/icons/Icon.vue'

export type AiCreationMode = 'dialogue' | 'image'

defineProps<{ modelValue: AiCreationMode }>()
defineEmits<{ 'update:modelValue': [value: AiCreationMode] }>()
</script>

<style scoped>
.ai-mode-tabs {
  @apply inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 p-1 text-sm dark:bg-dark-800;
}

.ai-mode-tab {
  @apply inline-flex h-8 items-center gap-1.5 rounded-full px-3 font-medium transition;
}

.ai-mode-tab-active {
  @apply bg-white text-gray-950 shadow-sm dark:bg-dark-700 dark:text-white;
}

.ai-mode-tab-idle {
  @apply text-gray-500 hover:text-gray-900 dark:text-dark-300 dark:hover:text-white;
}
</style>
