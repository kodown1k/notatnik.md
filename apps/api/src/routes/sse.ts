// apps/api/src/routes/sse.ts
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { addSseListener, removeSseListener } from '../watcher'
import { addVaultListener, removeVaultListener } from './vault'
import type { SseEvent } from '@notatnik/shared'

export const sseRoutes = new Hono()

sseRoutes.get('/', (c) => {
  return streamSSE(c, async (stream) => {
    await stream.writeSSE({ data: 'connected' })

    const send = async (event: SseEvent) => {
      try {
        await stream.writeSSE({ data: JSON.stringify(event) })
      } catch {
        // client disconnected
      }
    }

    addSseListener(send)
    addVaultListener(send)

    // Resolve when client disconnects so the sleep loop can exit quickly
    let resolveAbort!: () => void
    const abortPromise = new Promise<void>(r => { resolveAbort = r })
    stream.onAbort(resolveAbort)

    // Keep connection alive with periodic pings; stream.pipe() must NOT be used
    // because it calls writer.releaseLock(), causing all subsequent writeSSE() to silently fail
    while (!stream.aborted) {
      await Promise.race([abortPromise, stream.sleep(25_000)])
      if (stream.aborted) break
      try {
        await stream.writeSSE({ data: 'ping' })
      } catch {
        break
      }
    }

    removeSseListener(send)
    removeVaultListener(send)
  })
})
