<template>
  <div v-if="svg" class="mermaid-diagram" @click="openFullscreen" v-html="svg" />
  <div v-else-if="error" class="mermaid-diagram">
    <pre class="mermaid-error">{{ error }}</pre>
  </div>

  <Teleport to="body">
    <div v-if="fullscreen" class="mermaid-overlay"
      @click.self="closeFullscreen"
      @wheel.prevent="onWheel">
      <div class="mermaid-fullscreen"
        ref="fsContainer"
        @wheel.prevent="onWheel"
        @pointerdown="onPointerDown" />
      <div class="mermaid-controls">
        <button @click="zoomIn">+</button>
        <button @click="resetView">{{ Math.round(zoom * 100) }}%</button>
        <button @click="zoomOut">&minus;</button>
        <button class="close-btn" @click="closeFullscreen">&times;</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import mermaid from 'mermaid'

const props = defineProps<{ code: string }>()
const svg = ref('')
const error = ref('')
const fullscreen = ref(false)
const zoom = ref(1)
const pan = ref({ x: 0, y: 0 })
const fsContainer = ref<HTMLElement>()

let idCounter = 0
let viewBox = { x: 0, y: 0, w: 800, h: 600 }

async function render() {
  const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'default' : 'dark'
  mermaid.initialize({ startOnLoad: false, theme, securityLevel: 'strict' })
  try {
    const id = `mermaid-${Date.now()}-${idCounter++}`
    const { svg: rendered } = await mermaid.render(id, props.code)
    svg.value = rendered
    error.value = ''

    const tmp = document.createElement('div')
    tmp.innerHTML = rendered
    const svgEl = tmp.querySelector('svg')
    if (svgEl) {
      const vb = svgEl.getAttribute('viewBox')
      if (vb) {
        const p = vb.split(/[\s,]+/).map(Number)
        if (p.length === 4) viewBox = { x: p[0], y: p[1], w: p[2], h: p[3] }
      }
    }
  } catch {
    svg.value = ''
    error.value = props.code
  }
}

function syncFullscreenSvg() {
  const container = fsContainer.value
  if (!container || !svg.value) return

  container.innerHTML = svg.value
  const svgEl = container.querySelector('svg')
  if (!svgEl) return

  svgEl.removeAttribute('width')
  svgEl.removeAttribute('height')
  svgEl.removeAttribute('style')
  svgEl.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`)
  applyTransform()
}

function applyTransform() {
  const container = fsContainer.value
  if (!container) return
  const svgEl = container.querySelector('svg')
  if (!svgEl) return

  const vw = window.innerWidth * 0.9
  const vh = window.innerHeight * 0.85
  const aspect = viewBox.w / viewBox.h
  let w: number, h: number
  if (vw / vh > aspect) {
    h = vh
    w = h * aspect
  } else {
    w = vw
    h = w / aspect
  }

  w *= zoom.value
  h *= zoom.value

  svgEl.style.width = `${w}px`
  svgEl.style.height = `${h}px`
  container.style.transform = `translate(${pan.value.x}px, ${pan.value.y}px)`
}

onMounted(render)
watch(() => props.code, render)

watch([zoom, pan], () => {
  if (fullscreen.value) applyTransform()
}, { deep: true })

function openFullscreen() {
  fullscreen.value = true
  zoom.value = 1
  pan.value = { x: 0, y: 0 }
  nextTick(syncFullscreenSvg)
}

function closeFullscreen() {
  fullscreen.value = false
}

function resetView() {
  zoom.value = 1
  pan.value = { x: 0, y: 0 }
}

function clampZoom(z: number) {
  return Math.min(Math.max(z, 0.1), 10)
}

function zoomIn() { zoom.value = clampZoom(zoom.value * 1.3) }
function zoomOut() { zoom.value = clampZoom(zoom.value / 1.3) }

function onWheel(e: WheelEvent) {
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
  zoom.value = clampZoom(zoom.value * factor)
}

let dragging = false
let lastPos = { x: 0, y: 0 }

function onPointerDown(e: PointerEvent) {
  dragging = true
  lastPos = { x: e.clientX, y: e.clientY }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  const el = e.currentTarget as HTMLElement
  el.addEventListener('pointermove', onPointerMove)
  el.addEventListener('pointerup', onPointerUp)
}

function onPointerMove(e: PointerEvent) {
  if (!dragging) return
  pan.value = {
    x: pan.value.x + e.clientX - lastPos.x,
    y: pan.value.y + e.clientY - lastPos.y,
  }
  lastPos = { x: e.clientX, y: e.clientY }
}

function onPointerUp(e: PointerEvent) {
  dragging = false
  const el = e.currentTarget as HTMLElement
  el.removeEventListener('pointermove', onPointerMove)
  el.removeEventListener('pointerup', onPointerUp)
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && fullscreen.value) closeFullscreen()
}

onMounted(() => document.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeyDown))
</script>

<style scoped>
.mermaid-diagram {
  display: flex;
  justify-content: center;
  padding: 12px 0;
  overflow-x: auto;
  cursor: pointer;
  border-radius: var(--radius);
  transition: background 0.15s;
}

.mermaid-diagram:hover {
  background: rgba(255, 255, 255, 0.03);
}

[data-theme="light"] .mermaid-diagram:hover {
  background: rgba(0, 0, 0, 0.03);
}

.mermaid-diagram :deep(svg) {
  max-width: 100%;
  height: auto;
}

.mermaid-error {
  color: var(--text-secondary);
  font-size: 0.85rem;
  white-space: pre-wrap;
}

.mermaid-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: grab;
}

.mermaid-overlay:active {
  cursor: grabbing;
}

.mermaid-fullscreen {
  user-select: none;
  touch-action: none;
}

.mermaid-controls {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  background: rgba(30, 30, 30, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 4px;
  backdrop-filter: blur(12px);
}

.mermaid-controls button {
  background: none;
  border: none;
  color: #eee;
  font-size: 0.9rem;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  min-width: 40px;
  transition: background 0.15s;
}

.mermaid-controls button:hover {
  background: rgba(255, 255, 255, 0.12);
}

.close-btn {
  font-size: 1.2rem !important;
  margin-left: 4px;
}
</style>
