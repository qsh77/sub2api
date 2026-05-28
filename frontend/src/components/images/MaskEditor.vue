<template>
  <div class="space-y-3">
    <div ref="wrapEl" class="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-dark-700 dark:bg-dark-900">
      <img ref="imgEl" :src="src" alt="" class="block w-full select-none" @load="resizeCanvas" />
      <canvas
        ref="canvasEl"
        class="absolute inset-0 h-full w-full touch-none"
        @pointerdown="startStroke"
        @pointermove="moveStroke"
        @pointerup="endStroke"
        @pointerleave="endStroke"
      />
    </div>
    <div class="flex items-center gap-2">
      <input v-model.number="brush" type="range" min="8" max="96" class="min-w-0 flex-1" />
      <button type="button" class="btn btn-secondary" @click="undo">Undo</button>
      <button type="button" class="btn btn-secondary" @click="clear">Clear</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'

const props = defineProps<{ src: string }>()
const emit = defineEmits<{ 'update:maskBlob': [Blob | null] }>()

const wrapEl = ref<HTMLElement | null>(null)
const imgEl = ref<HTMLImageElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const brush = ref(32)
const drawing = ref(false)
const snapshots: ImageData[] = []

watch(() => props.src, () => {
  void nextTick(() => {
    snapshots.length = 0
    resizeCanvas()
  })
})

onMounted(resizeCanvas)

function resizeCanvas() {
  const img = imgEl.value
  const canvas = canvasEl.value
  if (!img || !canvas || !img.naturalWidth || !img.naturalHeight) return
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  clear()
}

function startStroke(event: PointerEvent) {
  const ctx = context()
  if (!ctx) return
  snapshots.push(ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height))
  drawing.value = true
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = 'rgba(255,255,255,0.82)'
  ctx.lineWidth = brush.value
  const point = canvasPoint(event)
  ctx.beginPath()
  ctx.moveTo(point.x, point.y)
  ctx.lineTo(point.x, point.y)
  ctx.stroke()
}

function moveStroke(event: PointerEvent) {
  const ctx = context()
  if (!ctx || !drawing.value) return
  const point = canvasPoint(event)
  ctx.lineTo(point.x, point.y)
  ctx.stroke()
}

function endStroke() {
  if (!drawing.value) return
  drawing.value = false
  exportMask()
}

function undo() {
  const ctx = context()
  const last = snapshots.pop()
  if (!ctx || !last) return
  ctx.putImageData(last, 0, 0)
  exportMask()
}

function clear() {
  const ctx = context()
  if (!ctx) return
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  emit('update:maskBlob', null)
}

function exportMask() {
  const canvas = canvasEl.value
  if (!canvas) return
  canvas.toBlob((blob) => emit('update:maskBlob', blob), 'image/png')
}

function context() {
  return canvasEl.value?.getContext('2d') || null
}

function canvasPoint(event: PointerEvent) {
  const canvas = canvasEl.value!
  const rect = canvas.getBoundingClientRect()
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  }
}
</script>
