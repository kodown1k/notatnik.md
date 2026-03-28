// apps/frontend/src/stores/sse.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useVaultStore } from './vault'
import type { SseEvent } from '@notatnik/shared'

export const useSseStore = defineStore('sse', () => {
  const connected = ref(false)
  let es: EventSource | null = null
  let retryTimeout: ReturnType<typeof setTimeout> | null = null

  // currentFile is set by FileView so SSE knows what's open
  const currentFile = ref('')

  // Callback for FileView to reload content when its file changes
  let onCurrentFileChanged: (() => void) | null = null

  function setCurrentFile(filename: string, reloadCallback: () => void) {
    currentFile.value = filename
    onCurrentFileChanged = reloadCallback
  }

  function clearCurrentFile() {
    currentFile.value = ''
    onCurrentFileChanged = null
  }

  function connect() {
    if (es) return

    es = new EventSource('/api/sse')

    es.onopen = () => { connected.value = true }

    es.onmessage = (event) => {
      if (event.data === 'ping' || event.data === 'connected') return

      let parsed: SseEvent
      try { parsed = JSON.parse(event.data) }
      catch { return }

      const vaultStore = useVaultStore()

      if (parsed.type === 'file:changed') {
        if (parsed.filename === currentFile.value) {
          onCurrentFileChanged?.()
        } else {
          vaultStore.markChanged(parsed.filename)
        }
      } else if (parsed.type === 'file:added' || parsed.type === 'file:removed') {
        vaultStore.refreshFiles()
        // Atomic saves (unlink+rename) fire 'file:added' instead of 'file:changed'
        if (parsed.type === 'file:added' && parsed.filename === currentFile.value) {
          onCurrentFileChanged?.()
        }
      } else if (parsed.type === 'vault:changed') {
        vaultStore.loadVault()
      }
    }

    es.onerror = () => {
      connected.value = false
      es?.close()
      es = null
      if (retryTimeout) clearTimeout(retryTimeout)
      retryTimeout = setTimeout(connect, 3000)
    }
  }

  function disconnect() {
    if (retryTimeout) clearTimeout(retryTimeout)
    es?.close()
    es = null
    connected.value = false
  }

  return { connected, currentFile, connect, disconnect, setCurrentFile, clearCurrentFile }
})
