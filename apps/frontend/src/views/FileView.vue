<!-- apps/frontend/src/views/FileView.vue -->
<template>
  <div class="file-view">
    <!-- File toolbar -->
    <div v-if="doc" class="file-toolbar">
      <button class="toolbar-btn" @click="downloadFile" title="Pobierz plik .md" aria-label="Pobierz plik">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span>Pobierz</span>
      </button>
      <button class="toolbar-btn toolbar-btn--danger" @click="showDeleteConfirm = true" title="Usuń plik" aria-label="Usuń plik">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          <line x1="10" y1="11" x2="10" y2="17"/>
          <line x1="14" y1="11" x2="14" y2="17"/>
        </svg>
        <span>Usuń</span>
      </button>
    </div>

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
          <button class="diff-btn diff-btn-accept" @click="acceptDiff">Zaakceptuj</button>
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

    <!-- Delete confirmation dialog -->
    <Teleport to="body">
      <div v-if="showDeleteConfirm" class="delete-backdrop" @click.self="showDeleteConfirm = false">
        <div class="delete-dialog">
          <div class="delete-dialog-header">
            <h3>Usuń plik</h3>
          </div>
          <div class="delete-dialog-body">
            <p>Czy na pewno chcesz usunąć plik <strong>{{ currentFilename }}</strong>?</p>
            <p class="delete-warning">Ta operacja jest nieodwracalna.</p>
          </div>
          <div class="delete-dialog-footer">
            <button class="delete-dialog-btn delete-dialog-btn--cancel" @click="showDeleteConfirm = false">Anuluj</button>
            <button class="delete-dialog-btn delete-dialog-btn--confirm" @click="deleteFile" :disabled="deleting">
              {{ deleting ? 'Usuwanie...' : 'Usuń' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { parse } from '../parser'
import { useVaultStore } from '../stores/vault'
import { useSseStore } from '../stores/sse'
import ProgressBar from '../components/ProgressBar.vue'
import MarkdownRenderer from '../components/MarkdownRenderer.vue'
import type { MdDocument, MdItem, MdChapter, MdSection, MdSubsection, Progress } from '@notatnik/shared'
import { computeDiff, type DiffLine } from '../diff'

const route = useRoute()
const router = useRouter()
const vaultStore = useVaultStore()
const sseStore = useSseStore()

const doc = ref<MdDocument | null>(null)
const loading = ref(false)
const error = ref('')
let lastEtag = ''
let pendingEtag = ''
let diffInFlight = false
const rawText = ref('')
const pendingText = ref<string | null>(null)
const diffLines = ref<DiffLine[]>([])
const showDeleteConfirm = ref(false)
const deleting = ref(false)

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

async function handleToggle(item: MdItem) {
  const newChecked = !item.checked
  item.checked = newChecked
  saveProgress(item)
  if (doc.value) recomputeProgress(doc.value)

  // Persist to file
  try {
    const res = await fetch(`/api/files/${currentFilename.value}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: item.text, checked: newChecked }),
    })
    if (res.ok) {
      // Update rawText so SSE-triggered fetchAndDiff won't show a diff for our own change
      const freshRes = await fetch(`/api/files/${currentFilename.value}`)
      if (freshRes.ok) {
        rawText.value = await freshRes.text()
        lastEtag = freshRes.headers.get('ETag') ?? ''
      }
    }
  } catch {
    // Revert on failure
    item.checked = !newChecked
    saveProgress(item)
    if (doc.value) recomputeProgress(doc.value)
  }
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
  if (diffInFlight) return
  if (rawText.value === '') return  // initial load not yet complete
  diffInFlight = true
  try {
    const res = await fetch(`/api/files/${currentFilename.value}`, {
      headers: lastEtag ? { 'If-None-Match': lastEtag } : {},
    })
    if (res.status === 304) return
    if (!res.ok) return

    const newEtag = res.headers.get('ETag') ?? ''
    const newText = await res.text()
    const lines = computeDiff(rawText.value, newText)

    if (lines.length === 0) {
      // No visible changes — silent reload
      lastEtag = newEtag
      doc.value = parse(newText, currentFilename.value)
      rawText.value = newText
      loadProgress()
      return
    }

    pendingEtag = newEtag
    pendingText.value = newText
    diffLines.value = lines
  } catch {
    // Silently ignore fetch errors during background diff
  } finally {
    diffInFlight = false
  }
}

function acceptDiff() {
  if (!pendingText.value) return
  doc.value = parse(pendingText.value, currentFilename.value)
  rawText.value = pendingText.value
  lastEtag = pendingEtag
  loadProgress()
  pendingText.value = null
  diffLines.value = []
}

function dismissDiff() {
  pendingText.value = null
  diffLines.value = []
}

// Load file, but if it has a pending change and we have a snapshot, show diff instead
async function loadFileOrDiff() {
  const filename = currentFilename.value
  const snapshot = vaultStore.getSnapshot(filename)
  const wasChanged = vaultStore.changedFiles.has(filename)
  vaultStore.clearChanged(filename)

  if (snapshot !== null && wasChanged) {
    loading.value = true
    error.value = ''
    try {
      const res = await fetch(`/api/files/${filename}`)
      if (!res.ok) { error.value = 'Nie znaleziono pliku'; return }

      lastEtag = res.headers.get('ETag') ?? ''
      const newText = await res.text()
      rawText.value = snapshot
      doc.value = parse(snapshot, filename)
      loadProgress()

      const lines = computeDiff(snapshot, newText)
      if (lines.length > 0) {
        pendingText.value = newText
        diffLines.value = lines
      } else {
        doc.value = parse(newText, filename)
        rawText.value = newText
        loadProgress()
      }
    } catch {
      error.value = 'Błąd ładowania pliku'
    } finally {
      loading.value = false
    }
    return
  }

  await loadFile()
}

onMounted(() => {
  loadFileOrDiff()
  sseStore.setCurrentFile(currentFilename.value, fetchAndDiff)
})

onUnmounted(() => {
  if (rawText.value) vaultStore.saveSnapshot(currentFilename.value, rawText.value)
  sseStore.clearCurrentFile()
})

function downloadFile() {
  if (!rawText.value) return
  const blob = new Blob([rawText.value], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = currentFilename.value.split('/').pop() ?? 'plik.md'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function deleteFile() {
  deleting.value = true
  try {
    const res = await fetch(`/api/files/${currentFilename.value}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      error.value = data.error ?? 'Nie udało się usunąć pliku'
      return
    }
    showDeleteConfirm.value = false
    router.push('/')
  } catch {
    error.value = 'Nie udało się usunąć pliku'
  } finally {
    deleting.value = false
  }
}

function scrollToTop() {
  const el = document.querySelector('.main-content')
  if (el) el.scrollTop = 0
}

watch(currentFilename, (newFilename, oldFilename) => {
  if (oldFilename && rawText.value) vaultStore.saveSnapshot(oldFilename, rawText.value)
  lastEtag = ''
  pendingEtag = ''
  rawText.value = ''
  doc.value = null
  pendingText.value = null
  diffLines.value = []
  scrollToTop()
  loadFileOrDiff()
  sseStore.setCurrentFile(newFilename, fetchAndDiff)
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
.file-view { padding: 24px; max-width: var(--content-max-width, 900px); margin: 0 auto; }

.file-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px 10px;
  font-size: 0.8rem;
  font-family: var(--font-sans);
  transition: color var(--transition), border-color var(--transition), background var(--transition);
}

.toolbar-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
}

.toolbar-btn--danger:hover {
  color: #ef4444;
  border-color: #ef4444;
}

.toolbar-btn svg { width: 16px; height: 16px; }

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

.delete-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.delete-dialog {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  width: 380px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.delete-dialog-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.delete-dialog-header h3 {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
}

.delete-dialog-body {
  padding: 16px 20px;
}

.delete-dialog-body p {
  font-size: 0.85rem;
  color: var(--text-primary);
  line-height: 1.5;
  margin: 0;
}

.delete-dialog-body strong {
  word-break: break-all;
}

.delete-warning {
  margin-top: 8px !important;
  color: var(--text-secondary) !important;
  font-size: 0.8rem !important;
}

.delete-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
}

.delete-dialog-btn {
  font-size: 0.8rem;
  padding: 6px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  cursor: pointer;
  font-family: var(--font-sans);
  font-weight: 500;
  transition: background var(--transition), color var(--transition);
}

.delete-dialog-btn--cancel {
  background: transparent;
  color: var(--text-secondary);
}

.delete-dialog-btn--cancel:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.delete-dialog-btn--confirm {
  background: #ef4444;
  color: #fff;
  border-color: #ef4444;
  font-weight: 600;
}

.delete-dialog-btn--confirm:hover {
  background: #dc2626;
  border-color: #dc2626;
}

.delete-dialog-btn--confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
