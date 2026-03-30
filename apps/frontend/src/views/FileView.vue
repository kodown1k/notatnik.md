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

    <!-- Diff panel: shown when an external change is detected -->
    <div v-if="diffLines.length > 0" class="diff-panel">
      <div class="diff-header">
        <span class="diff-title">⚡ Plik zaktualizowany</span>
        <div class="diff-actions">
          <button class="diff-btn diff-btn-dismiss" @click="dismissDiff">Zamknij</button>
          <button class="diff-btn diff-btn-accept" @click="acceptDiff">Zaakceptuj zmiany</button>
        </div>
      </div>
      <div class="diff-body">
        <template v-for="(line, idx) in diffLines" :key="idx">
          <div v-if="line.type === 'sep'" class="diff-sep">···</div>
          <div
            v-else
            class="diff-line"
            :class="`diff-line--${line.type}`"
          >
            <span class="diff-prefix">{{ line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ' }}</span>
            <span class="diff-text">{{ line.text }}</span>
          </div>
        </template>
      </div>
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
import { computeDiff, type DiffLine } from '../diff'

const route = useRoute()
const vaultStore = useVaultStore()
const sseStore = useSseStore()

const doc = ref<MdDocument | null>(null)
const loading = ref(false)
const error = ref('')
let lastEtag = ''
const rawText = ref('')
const pendingText = ref<string | null>(null)
const diffLines = ref<DiffLine[]>([])

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
    rawText.value = text
    loadProgress()
  } catch {
    error.value = 'Błąd ładowania pliku'
  } finally {
    if (!silent) loading.value = false
  }
}

async function fetchAndDiff() {
  try {
    const res = await fetch(`/api/files/${currentFilename.value}`, {
      headers: lastEtag ? { 'If-None-Match': lastEtag } : {},
    })
    if (res.status === 304) return
    if (!res.ok) return

    lastEtag = res.headers.get('ETag') ?? ''
    const newText = await res.text()
    const lines = computeDiff(rawText.value, newText)

    if (lines.length === 0) {
      // No visible changes — silent reload
      doc.value = parse(newText, currentFilename.value)
      rawText.value = newText
      loadProgress()
      return
    }

    pendingText.value = newText
    diffLines.value = lines
  } catch {
    // Silently ignore fetch errors during background diff
  }
}

function acceptDiff() {
  if (!pendingText.value) return
  doc.value = parse(pendingText.value, currentFilename.value)
  rawText.value = pendingText.value
  loadProgress()
  pendingText.value = null
  diffLines.value = []
}

function dismissDiff() {
  pendingText.value = null
  diffLines.value = []
}

onMounted(() => {
  loadFile()
  vaultStore.clearChanged(currentFilename.value)
  sseStore.setCurrentFile(currentFilename.value, fetchAndDiff)
})

onUnmounted(() => {
  sseStore.clearCurrentFile()
})

watch(currentFilename, () => {
  lastEtag = ''
  doc.value = null
  pendingText.value = null
  diffLines.value = []
  loadFile()
  vaultStore.clearChanged(currentFilename.value)
  sseStore.setCurrentFile(currentFilename.value, fetchAndDiff)
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

.diff-panel {
  position: sticky;
  top: 0;
  z-index: 16;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 8px;
  overflow: hidden;
  background: var(--bg-elevated);
}

.diff-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
}

.diff-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

.diff-actions {
  display: flex;
  gap: 8px;
}

.diff-btn {
  font-size: 0.8rem;
  padding: 4px 10px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  cursor: pointer;
  font-family: var(--font-sans);
  transition: background var(--transition), color var(--transition);
}

.diff-btn-dismiss {
  background: transparent;
  color: var(--text-secondary);
}

.diff-btn-dismiss:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.diff-btn-accept {
  background: var(--accent);
  color: #000;
  border-color: var(--accent);
  font-weight: 600;
}

.diff-btn-accept:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.diff-body {
  max-height: 40vh;
  overflow-y: auto;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  line-height: 1.5;
}

.diff-line {
  display: flex;
  gap: 8px;
  padding: 1px 12px;
  white-space: pre-wrap;
  word-break: break-all;
}

.diff-line--add    { background: rgba(34, 197, 94, 0.12); color: #4ade80; }
.diff-line--remove { background: rgba(239, 68,  68, 0.12); color: #f87171; }
.diff-line--context { color: var(--text-secondary); }

.diff-prefix {
  flex-shrink: 0;
  width: 12px;
  user-select: none;
}

.diff-sep {
  text-align: center;
  padding: 2px 0;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 0.78rem;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  background: var(--bg-primary);
}
</style>
