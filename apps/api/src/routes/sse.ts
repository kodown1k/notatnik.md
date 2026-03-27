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

    const heartbeat = setInterval(async () => {
      try {
        await stream.writeSSE({ data: 'ping' })
      } catch {
        // client disconnected
      }
    }, 30_000)

    await stream.pipe(new ReadableStream({
      cancel() {
        clearInterval(heartbeat)
        removeSseListener(send)
        removeVaultListener(send)
      },
    }))
  })
})
