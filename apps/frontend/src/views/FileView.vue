<!-- apps/frontend/src/views/FileView.vue -->
<template>
  <div class="file-view">
    <!-- Sticky document progress -->
    <div class="doc-progress" v-if="doc && doc.progress.total > 0">
      <ProgressBar
        :total="doc.progress.total"
        :checked="doc.progress.checked"
        :label="doc.title"
        level="doc"
      />
    </div>

    <div v-if="loading" class="loading">Ładowanie...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <MarkdownRenderer
      v-else-if="doc"
      :doc="doc"
      :filename="currentFilename"
      @toggle="handleToggle"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { parse } from '../parser'
import { useVaultStore } from '../stores/vault'
import { useSseStore } from '../stores/sse'
import ProgressBar from '../components/ProgressBar.vue'
import MarkdownRenderer from '../components/MarkdownRenderer.vue'
import type { MdDocument, MdItem, MdChapter, MdSection, MdSubsection, Progress } from '@notatnik/shared'

const route = useRoute()
const vaultStore = useVaultStore()
const sseStore = useSseStore()

const doc = ref<MdDocument | null>(null)
const loading = ref(false)
const error = ref('')
let lastEtag = ''

const currentFilename = computed(() => {
  const p = route.params.path
  const name = Array.isArray(p) ? p[0] : p ?? ''
  return name.endsWith('.md') ? name : `${name}.md`
})

const PROGRESS_KEY = computed(() => `notatnik-progress-${currentFilename.value}`)

function loadProgress() {
  if (!doc.value) return
  try {
    const saved: Record<number, boolean> = JSON.parse(
      localStorage.getItem(PROGRESS_KEY.value) ?? '{}'
    )
    walkTasks(doc.value, (item) => {
      if (item.hash !== undefined && saved[item.hash] !== undefined) {
        item.checked = saved[item.hash]
      }
    })
    recomputeProgress(doc.value)
  } catch { /* ignore */ }
}

function saveProgress(item: MdItem) {
  try {
    const saved: Record<number, boolean> = JSON.parse(
      localStorage.getItem(PROGRESS_KEY.value) ?? '{}'
    )
    saved[item.hash!] = item.checked!
    localStorage.setItem(PROGRESS_KEY.value, JSON.stringify(saved))
  } catch { /* ignore */ }
}

function handleToggle(item: MdItem) {
  item.checked = !item.checked
  saveProgress(item)
  if (doc.value) recomputeProgress(doc.value)
}

async function loadFile(silent = false) {
  if (!silent) loading.value = true
  error.value = ''

  try {
    const res = await fetch(`/api/files/${currentFilename.value}`, {
      headers: lastEtag ? { 'If-None-Match': lastEtag } : {},
    })

    if (res.status === 304) return  // no change
    if (!res.ok) { error.value = 'Nie znaleziono pliku'; return }

    lastEtag = res.headers.get('ETag') ?? ''
    const text = await res.text()
    doc.value = parse(text, currentFilename.value)
    loadProgress()
  } catch {
    error.value = 'Błąd ładowania pliku'
  } finally {
    if (!silent) loading.value = false
  }
}

onMounted(() => {
  loadFile()
  vaultStore.clearChanged(currentFilename.value)
  sseStore.setCurrentFile(currentFilename.value, () => loadFile(true))
})

onUnmounted(() => {
  sseStore.clearCurrentFile()
})

watch(currentFilename, () => {
  lastEtag = ''
  doc.value = null
  loadFile()
  vaultStore.clearChanged(currentFilename.value)
  sseStore.setCurrentFile(currentFilename.value, () => loadFile(true))
})

// --- Progress recomputation helpers ---

function makeProgress(tasks: MdItem[], ...children: Progress[]): Progress {
  const childTotal = children.reduce((s, p) => s + p.total, 0)
  const childChecked = children.reduce((s, p) => s + p.checked, 0)
  const localTasks = tasks.filter((i) => i.type === 'task')
  const total = localTasks.length + childTotal
  const checked = localTasks.filter((i) => i.checked).length + childChecked
  return { total, checked, pct: total === 0 ? 0 : Math.round((checked / total) * 100) }
}

function recomputeProgress(d: MdDocument) {
  for (const ch of d.chapters) {
    for (const sec of ch.sections) {
      for (const sub of sec.subsections) {
        sub.progress = makeProgress(sub.items)
      }
      sec.progress = makeProgress(sec.items, ...sec.subsections.map((s) => s.progress))
    }
    ch.progress = makeProgress(ch.items, ...ch.sections.map((s) => s.progress))
  }
  d.progress = makeProgress(d.items, ...d.chapters.map((ch) => ch.progress))
}

function walkTasks(d: MdDocument, fn: (item: MdItem) => void) {
  for (const item of d.items) if (item.type === 'task') fn(item)
  for (const ch of d.chapters) {
    for (const item of ch.items) if (item.type === 'task') fn(item)
    for (const sec of ch.sections) {
      for (const item of sec.items) if (item.type === 'task') fn(item)
      for (const sub of sec.subsections) {
        for (const item of sub.items) if (item.type === 'task') fn(item)
      }
    }
  }
}
</script>

<style scoped>
.file-view { padding: 24px; max-width: 900px; margin: 0 auto; }

.doc-progress {
  position: sticky;
  top: 0;
  z-index: 15;
  background: rgba(15, 14, 13, 0.85);
  backdrop-filter: blur(20px) saturate(1.4);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 16px 12px;
  margin-bottom: 4px;
}

[data-theme="light"] .doc-progress {
  background: rgba(250, 250, 249, 0.92);
}

.loading, .error {
  padding: 40px;
  text-align: center;
  color: var(--text-secondary);
}

.error { color: #ef4444; }
</style>
