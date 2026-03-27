// apps/api/src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { vaultRoutes } from './routes/vault'
import { filesRoutes } from './routes/files'
import { sseRoutes } from './routes/sse'

const app = new Hono()

app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'If-None-Match'],
  exposeHeaders: ['ETag', 'Last-Modified'],
}))

app.route('/api/vault', vaultRoutes)
app.route('/api/files', filesRoutes)
app.route('/api/sse', sseRoutes)

app.get('/api/health', (c) => c.json({ ok: true }))

export default app

const port = Number(process.env.PORT ?? 3001)
console.log(`API listening on http://localhost:${port}`)

Bun.serve({ fetch: app.fetch, port })
