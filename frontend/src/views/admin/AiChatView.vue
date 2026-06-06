<template>
  <ImageChatWorkspace v-if="mode === 'image'" scope="admin" active-mode="image" @mode-change="setMode" />
  <AiChatWorkspace v-else scope="admin" active-mode="dialogue" @mode-change="setMode" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AiChatWorkspace from '@/components/chat/AiChatWorkspace.vue'
import ImageChatWorkspace from '@/components/images/ImageChatWorkspace.vue'
import type { AiCreationMode } from '@/components/ai/AiModeTabs.vue'

const route = useRoute()
const router = useRouter()
const mode = computed<AiCreationMode>(() => (
  route.path === '/admin/images' || route.query.mode === 'image' ? 'image' : 'dialogue'
))

function setMode(value: AiCreationMode) {
  const query = { ...route.query }
  if (value === 'image') query.mode = 'image'
  else delete query.mode
  void router.replace({ path: '/admin/chat', query })
}
</script>
