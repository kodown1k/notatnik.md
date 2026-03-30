// apps/api/src/watcher.ts
import chokidar, { FSWatcher } from 'chokidar'
import { relative } from 'path'
import type { SseEvent } from '@notatnik/shared'

type SseListener = (event: SseEvent) => void

let watcher: FSWatcher | null = null
const listeners = new Set<SseListener>()

export function addSseListener(fn: SseListener) {
  listeners.add(fn)
}

export function removeSseListener(fn: SseListener) {
  listeners.delete(fn)
}

function broadcast(event: SseEvent) {
  for (const fn of listeners) fn(event)
}

export function startWatcher(vaultPath: string) {
  if (watcher) {
    watcher.close()
    watcher = null
  }

  if (!vaultPath) return

  watcher = chokidar.watch(vaultPath, {
    ignoreInitial: true,
    depth: undefined,
    usePolling: true,
    interval: 800,
  })

  watcher.on('change', (filePath) => {
    const filename = relative(vaultPath, filePath)
    if (filename.endsWith('.md')) {
      broadcast({ type: 'file:changed', filename })
    }
  })

  watcher.on('add', (filePath) => {
    const filename = relative(vaultPath, filePath)
    if (filename.endsWith('.md')) {
      broadcast({ type: 'file:added', filename })
    }
  })

  watcher.on('unlink', (filePath) => {
    const filename = relative(vaultPath, filePath)
    if (filename.endsWith('.md')) {
      broadcast({ type: 'file:removed', filename })
    }
  })
}

export function stopWatcher() {
  watcher?.close()
  watcher = null
}
