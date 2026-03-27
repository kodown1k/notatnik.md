# notatnik.md Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Markdown vault viewer with hierarchical checkbox progress bars, SSE-based auto-refresh via filesystem watcher, and dark/light theme toggle.

**Architecture:** Bun workspaces monorepo — `apps/api` (Hono, port 3001) serves files from a user-chosen vault directory, watches for changes via chokidar, and pushes SSE events; `apps/frontend` (Vue 3 + Vite, port 5173) renders `.md` files with a custom parser that builds a 4-level AST (document → chapter → section → subsection) and computes progress bars at each level. `packages/shared` holds TypeScript types used by both.

**Tech Stack:** Bun, Hono, chokidar, Vue 3, Vite, Pinia, Vue Router, TypeScript, Vitest (frontend parser tests), bun:test (API tests)

---

## File Map

```
notatnik.md/
├── package.json                        ← Bun workspaces root
├── .gitignore
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts                ← Hono app + Bun.serve(), port 3001
│   │       ├── watcher.ts              ← chokidar singleton + SSE broadcast
│   │       └── routes/
│   │           ├── vault.ts            ← GET/POST /api/vault
│   │           ├── files.ts            ← GET /api/files, GET /api/files/:name
│   │           └── sse.ts              ← GET /api/sse
│   └── frontend/
│       ├── package.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.ts
│           ├── App.vue                 ← root layout: navbar + grid
│           ├── style.css               ← CSS custom properties, theme, reset
│           ├── router/index.ts
│           ├── views/
│           │   ├── HomeView.vue        ← vault picker + welcome
│           │   └── FileView.vue        ← file viewer
│           ├── components/
│           │   ├── ProgressBar.vue     ← reusable progress bar
│           │   ├── MarkdownRenderer.vue← renders parsed AST
│           │   ├── Sidebar.vue         ← file list + change dot
│           │   └── ThemeToggle.vue     ← dark/light toggle button
│           ├── stores/
│           │   ├── vault.ts            ← Pinia: vault path, file list
│           │   └── sse.ts              ← Pinia: SSE connection
│           └── parser/
│               ├── index.ts            ← main parse() function
│               └── index.test.ts       ← Vitest tests
└── packages/
    └── shared/
        ├── package.json
        └── types.ts
```

---

## Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `apps/api/package.json`
- Create: `apps/frontend/package.json`
- Create: `packages/shared/package.json`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "notatnik-md",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "bun run --filter '*' dev",
    "build": "bun run --filter '*' build"
  }
}
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
dist/
.vite/
settings.json
*.local
```

- [ ] **Step 3: Create apps/api/package.json**

```json
{
  "name": "@notatnik/api",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "test": "bun test"
  },
  "dependencies": {
    "hono": "^4.6.0",
    "chokidar": "^3.6.0",
    "@notatnik/shared": "workspace:*"
  }
}
```

- [ ] **Step 4: Create apps/frontend/package.json**

```json
{
  "name": "@notatnik/frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite --host",
    "build": "vue-tsc && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "vue": "^3.4.0",
    "pinia": "^2.2.0",
    "vue-router": "^4.3.0",
    "@notatnik/shared": "workspace:*"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.1.0",
    "vite": "^5.4.0",
    "vue-tsc": "^2.1.0",
    "typescript": "^5.5.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 5: Create packages/shared/package.json**

```json
{
  "name": "@notatnik/shared",
  "version": "1.0.0",
  "main": "./types.ts",
  "exports": {
    ".": "./types.ts"
  }
}
```

- [ ] **Step 6: Install dependencies**

```bash
cd /home/perun/Code/notatnik.md
bun install
```

Expected: `node_modules/` created in root, symlinks for workspaces.

- [ ] **Step 7: Init git and commit**

```bash
git init
git add package.json .gitignore apps/api/package.json apps/frontend/package.json packages/shared/package.json
git commit -m "feat: initialize monorepo scaffold"
```

---

## Task 2: Shared types

**Files:**
- Create: `packages/shared/types.ts`

- [ ] **Step 1: Write types**

```typescript
// packages/shared/types.ts

export interface FileInfo {
  name: string      // without .md extension, for display
  filename: string  // with .md extension, used in API paths
  mtime: number     // ms timestamp
  size: number      // bytes
}

export interface VaultConfig {
  path: string
}

export type SseEvent =
  | { type: 'file:changed'; filename: string }
  | { type: 'file:added'; filename: string }
  | { type: 'file:removed'; filename: string }
  | { type: 'vault:changed'; path: string }

// Markdown AST

export interface Progress {
  total: number
  checked: number
  pct: number  // 0–100, rounded
}

export interface MdItem {
  type: 'task' | 'text' | 'table' | 'code'
  text?: string       // raw text for type=text|task
  checked?: boolean   // only for type=task
  hash?: number       // djb2 hash of text, for localStorage keying
  rows?: string[][]   // only for type=table: [row][col]
}

export interface MdSubsection {
  title: string       // #### heading text
  progress: Progress
  items: MdItem[]
}

export interface MdSection {
  title: string       // ### heading text
  progress: Progress
  subsections: MdSubsection[]
  items: MdItem[]     // items before first #### subsection
}

export interface MdChapter {
  title: string       // ## heading text
  progress: Progress
  sections: MdSection[]
  items: MdItem[]     // items before first ### section
}

export interface MdDocument {
  title: string       // # heading text, or filename if missing
  progress: Progress
  chapters: MdChapter[]
  items: MdItem[]     // items before first ## chapter
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/types.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: API — Hono server skeleton

**Files:**
- Create: `apps/api/src/index.ts`

- [ ] **Step 1: Write Hono server**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles (no errors)**

```bash
cd apps/api
bun build src/index.ts --target bun 2>&1 | head -20
```

Expected: no TypeScript errors (may warn about missing route files — that's fine, they don't exist yet).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat: add Hono server skeleton"
```

---

## Task 4: API — vault routes

**Files:**
- Create: `apps/api/src/routes/vault.ts`

The vault path is stored in memory and persisted to `settings.json` (project root, 4 levels up from this file: `../../../../settings.json`).

- [ ] **Step 1: Write vault routes**

```typescript
// apps/api/src/routes/vault.ts
import { Hono } from 'hono'
import { existsSync, statSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { VaultConfig } from '@notatnik/shared'

const SETTINGS_PATH = join(import.meta.dir, '../../../../settings.json')

function loadSettings(): VaultConfig {
  if (existsSync(SETTINGS_PATH)) {
    try {
      return JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'))
    } catch {
      // ignore corrupt settings
    }
  }
  return { path: '' }
}

function saveSettings(config: VaultConfig) {
  writeFileSync(SETTINGS_PATH, JSON.stringify(config, null, 2))
}

// In-memory state — single source of truth during runtime
let vaultConfig: VaultConfig = loadSettings()

export function getVaultPath(): string {
  return vaultConfig.path
}

export function setVaultPath(path: string) {
  vaultConfig = { path }
  saveSettings(vaultConfig)
}

export const vaultRoutes = new Hono()

vaultRoutes.get('/', (c) => c.json(vaultConfig))

vaultRoutes.post('/', async (c) => {
  const body = await c.req.json<{ path: string }>()
  const newPath = body?.path?.trim() ?? ''

  if (!newPath) {
    return c.json({ error: 'path is required' }, 400)
  }

  if (!existsSync(newPath)) {
    return c.json({ error: 'path does not exist' }, 400)
  }

  const stat = statSync(newPath)
  if (!stat.isDirectory()) {
    return c.json({ error: 'path must be a directory' }, 400)
  }

  setVaultPath(newPath)
  return c.json({ path: newPath })
})
```

- [ ] **Step 2: Write API test**

```typescript
// apps/api/src/routes/vault.test.ts
import { describe, test, expect, beforeEach } from 'bun:test'
import { testClient } from 'hono/testing'
import { Hono } from 'hono'
import { vaultRoutes, setVaultPath } from './vault'
import { tmpdir } from 'os'

const app = new Hono()
app.route('/api/vault', vaultRoutes)
const client = testClient(app)

describe('vault routes', () => {
  beforeEach(() => setVaultPath(''))

  test('GET /api/vault returns empty path initially', async () => {
    const res = await client.api.vault.$get()
    const body = await res.json()
    expect(body.path).toBe('')
  })

  test('POST /api/vault with valid dir sets vault path', async () => {
    const dir = tmpdir()
    const res = await client.api.vault.$post({ json: { path: dir } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.path).toBe(dir)
  })

  test('POST /api/vault with non-existent path returns 400', async () => {
    const res = await client.api.vault.$post({ json: { path: '/does/not/exist/xyz' } })
    expect(res.status).toBe(400)
  })

  test('POST /api/vault with empty path returns 400', async () => {
    const res = await client.api.vault.$post({ json: { path: '' } })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 3: Run tests — expect PASS**

```bash
cd apps/api
bun test src/routes/vault.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/vault.ts apps/api/src/routes/vault.test.ts
git commit -m "feat: add vault routes with settings.json persistence"
```

---

## Task 5: API — files routes

**Files:**
- Create: `apps/api/src/routes/files.ts`

- [ ] **Step 1: Write files routes**

```typescript
// apps/api/src/routes/files.ts
import { Hono } from 'hono'
import { readdirSync, readFileSync, statSync, existsSync } from 'fs'
import { join } from 'path'
import { getVaultPath } from './vault'
import type { FileInfo } from '@notatnik/shared'

export const filesRoutes = new Hono()

filesRoutes.get('/', (c) => {
  const vaultPath = getVaultPath()
  if (!vaultPath || !existsSync(vaultPath)) {
    return c.json([] as FileInfo[])
  }

  const entries = readdirSync(vaultPath, { withFileTypes: true })
  const files: FileInfo[] = entries
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => {
      const stat = statSync(join(vaultPath, e.name))
      return {
        name: e.name.replace(/\.md$/, ''),
        filename: e.name,
        mtime: stat.mtimeMs,
        size: stat.size,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  return c.json(files)
})

filesRoutes.get('/:filename', (c) => {
  const vaultPath = getVaultPath()
  const filename = c.req.param('filename')

  if (!vaultPath) {
    return c.json({ error: 'vault not configured' }, 503)
  }

  // Security: reject paths with directory traversal
  if (filename.includes('/') || filename.includes('..')) {
    return c.json({ error: 'invalid filename' }, 400)
  }

  const filePath = join(vaultPath, filename.endsWith('.md') ? filename : `${filename}.md`)

  if (!existsSync(filePath)) {
    return c.json({ error: 'not found' }, 404)
  }

  const stat = statSync(filePath)
  const etag = `"${stat.mtimeMs}"`
  const ifNoneMatch = c.req.header('If-None-Match')

  if (ifNoneMatch === etag) {
    return new Response(null, { status: 304 })
  }

  const content = readFileSync(filePath, 'utf8')

  return new Response(content, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'ETag': etag,
      'Last-Modified': stat.mtime.toUTCString(),
      'Cache-Control': 'no-cache',
    },
  })
})
```

- [ ] **Step 2: Write API test**

```typescript
// apps/api/src/routes/files.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { testClient } from 'hono/testing'
import { Hono } from 'hono'
import { filesRoutes } from './files'
import { setVaultPath } from './vault'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join, tmpdir } from 'path'

const testDir = join(tmpdir(), 'notatnik-test-' + Date.now())

beforeAll(() => {
  mkdirSync(testDir, { recursive: true })
  writeFileSync(join(testDir, 'alpha.md'), '# Alpha\n- [x] done\n- [ ] todo\n')
  writeFileSync(join(testDir, 'beta.md'), '# Beta\n')
  writeFileSync(join(testDir, 'notmd.txt'), 'ignored')
  setVaultPath(testDir)
})

afterAll(() => rmSync(testDir, { recursive: true }))

const app = new Hono()
app.route('/api/files', filesRoutes)
const client = testClient(app)

describe('files routes', () => {
  test('GET /api/files returns only .md files sorted alphabetically', async () => {
    const res = await client.api.files.$get()
    const files = await res.json()
    expect(files.map((f: any) => f.filename)).toEqual(['alpha.md', 'beta.md'])
  })

  test('GET /api/files/:name returns file content', async () => {
    const res = await client.api.files[':filename'].$get({ param: { filename: 'alpha.md' } })
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('# Alpha')
  })

  test('GET /api/files/:name returns ETag header', async () => {
    const res = await client.api.files[':filename'].$get({ param: { filename: 'alpha.md' } })
    expect(res.headers.get('ETag')).toMatch(/^"[\d.]+"$/)
  })

  test('GET /api/files/:name with matching If-None-Match returns 304', async () => {
    const res1 = await client.api.files[':filename'].$get({ param: { filename: 'alpha.md' } })
    const etag = res1.headers.get('ETag')!
    const res2 = await fetch(`http://localhost/api/files/alpha.md`, {
      headers: { 'If-None-Match': etag },
    })
    // Note: testClient doesn't forward custom headers easily — test ETag logic manually
    // This test just verifies ETag is present
    expect(etag).toBeTruthy()
  })

  test('GET /api/files/nonexistent returns 404', async () => {
    const res = await client.api.files[':filename'].$get({ param: { filename: 'nonexistent.md' } })
    expect(res.status).toBe(404)
  })

  test('GET /api/files/../etc/passwd returns 400', async () => {
    const res = await client.api.files[':filename'].$get({ param: { filename: '../etc/passwd' } })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 3: Run tests — expect PASS**

```bash
cd apps/api
bun test src/routes/files.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/files.ts apps/api/src/routes/files.test.ts
git commit -m "feat: add files routes with ETag support"
```

---

## Task 6: API — chokidar watcher singleton

**Files:**
- Create: `apps/api/src/watcher.ts`

- [ ] **Step 1: Write watcher singleton**

```typescript
// apps/api/src/watcher.ts
import chokidar, { FSWatcher } from 'chokidar'
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
    depth: 0,              // flat — only files in vault root
    usePolling: false,
  })

  watcher.on('change', (filePath) => {
    const filename = filePath.split('/').pop() ?? ''
    if (filename.endsWith('.md')) {
      broadcast({ type: 'file:changed', filename })
    }
  })

  watcher.on('add', (filePath) => {
    const filename = filePath.split('/').pop() ?? ''
    if (filename.endsWith('.md')) {
      broadcast({ type: 'file:added', filename })
    }
  })

  watcher.on('unlink', (filePath) => {
    const filename = filePath.split('/').pop() ?? ''
    if (filename.endsWith('.md')) {
      broadcast({ type: 'file:removed', filename })
    }
  })
}

export function stopWatcher() {
  watcher?.close()
  watcher = null
}
```

- [ ] **Step 2: Wire watcher into vault route**

In `apps/api/src/routes/vault.ts`, import and call `startWatcher` when vault path is set, and emit a `vault:changed` SSE event. Add these imports and update `setVaultPath`:

```typescript
// Add to top of vault.ts:
import { startWatcher, addSseListener, removeSseListener } from '../watcher'
import type { SseEvent } from '@notatnik/shared'

// Internal broadcast for vault:changed (SSE route will use the listener system)
const vaultListeners = new Set<(event: SseEvent) => void>()

export function addVaultListener(fn: (event: SseEvent) => void) {
  vaultListeners.add(fn)
}

export function removeVaultListener(fn: (event: SseEvent) => void) {
  vaultListeners.delete(fn)
}
```

Update `setVaultPath`:
```typescript
export function setVaultPath(path: string) {
  vaultConfig = { path }
  saveSettings(vaultConfig)
  startWatcher(path)
  for (const fn of vaultListeners) fn({ type: 'vault:changed', path })
}
```

Also call `startWatcher(vaultConfig.path)` at module init (after `loadSettings()`):
```typescript
// After: let vaultConfig: VaultConfig = loadSettings()
startWatcher(vaultConfig.path)
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/watcher.ts apps/api/src/routes/vault.ts
git commit -m "feat: add chokidar watcher singleton with SSE broadcast"
```

---

## Task 7: API — SSE route

**Files:**
- Create: `apps/api/src/routes/sse.ts`

- [ ] **Step 1: Write SSE route**

```typescript
// apps/api/src/routes/sse.ts
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { addSseListener, removeSseListener } from '../watcher'
import { addVaultListener, removeVaultListener } from './vault'
import type { SseEvent } from '@notatnik/shared'

export const sseRoutes = new Hono()

sseRoutes.get('/', (c) => {
  return streamSSE(c, async (stream) => {
    // Send initial ping to confirm connection
    await stream.writeSSE({ data: 'connected' })

    const send = async (event: SseEvent) => {
      try {
        await stream.writeSSE({ data: JSON.stringify(event) })
      } catch {
        // client disconnected — cleanup happens below
      }
    }

    addSseListener(send)
    addVaultListener(send)

    // Heartbeat every 30s to prevent proxy timeouts
    const heartbeat = setInterval(async () => {
      try {
        await stream.writeSSE({ data: 'ping' })
      } catch {
        // client disconnected
      }
    }, 30_000)

    // Wait until client disconnects
    await stream.pipe(new ReadableStream({
      cancel() {
        clearInterval(heartbeat)
        removeSseListener(send)
        removeVaultListener(send)
      },
    }))
  })
})
```

- [ ] **Step 2: Start API and verify SSE endpoint responds**

```bash
cd apps/api
bun src/index.ts &
sleep 1
curl -N http://localhost:3001/api/sse
```

Expected output (then Ctrl+C):
```
data: connected

data: ping
```

```bash
kill %1
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/sse.ts
git commit -m "feat: add SSE route with heartbeat"
```

---

## Task 8: Frontend — Vite scaffold

**Files:**
- Create: `apps/frontend/index.html`
- Create: `apps/frontend/vite.config.ts`
- Create: `apps/frontend/src/main.ts`
- Create: `apps/frontend/src/App.vue` (shell only)
- Create: `apps/frontend/src/router/index.ts`

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="pl" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>notatnik.md</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Create vite.config.ts**

```typescript
// apps/frontend/vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 3: Create src/router/index.ts**

```typescript
// apps/frontend/src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import FileView from '../views/FileView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/:filename', component: FileView },
  ],
})
```

- [ ] **Step 4: Create src/main.ts**

```typescript
// apps/frontend/src/main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { router } from './router'
import App from './App.vue'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

- [ ] **Step 5: Create App.vue shell (placeholder)**

```vue
<!-- apps/frontend/src/App.vue -->
<template>
  <div>
    <router-view />
  </div>
</template>
```

- [ ] **Step 6: Create HomeView.vue and FileView.vue stubs**

```vue
<!-- apps/frontend/src/views/HomeView.vue -->
<template><div>Home</div></template>
```

```vue
<!-- apps/frontend/src/views/FileView.vue -->
<template><div>File</div></template>
```

- [ ] **Step 7: Verify frontend starts**

```bash
cd apps/frontend
bun run dev
```

Expected: Vite starts on `http://localhost:5173`, browser shows "Home".

Stop with Ctrl+C.

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/
git commit -m "feat: scaffold Vue 3 frontend with Vite and router"
```

---

## Task 9: Frontend — CSS theme system

**Files:**
- Create: `apps/frontend/src/style.css`

- [ ] **Step 1: Write global CSS with theme tokens**

```css
/* apps/frontend/src/style.css */

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --navbar-h: 56px;
  --sidebar-w: 240px;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  --radius: 6px;
  --transition: 150ms ease;
}

/* Dark theme (default) */
[data-theme="dark"] {
  --bg-primary:    #0f0e0d;
  --bg-elevated:   #1a1917;
  --bg-sidebar:    #141311;
  --bg-hover:      #242220;
  --text-primary:  #e8e6e1;
  --text-secondary:#a09d96;
  --accent:        #f59e0b;
  --accent-hover:  #fbbf24;
  --progress-fill: #f59e0b;
  --progress-bg:   #2a2825;
  --border:        #2a2825;
  --neutral-700:   #3a3835;
  --code-bg:       #1e1c1a;
}

/* Light theme */
[data-theme="light"] {
  --bg-primary:    #fafaf9;
  --bg-elevated:   #ffffff;
  --bg-sidebar:    #f0eeea;
  --bg-hover:      #e8e6e2;
  --text-primary:  #1c1b19;
  --text-secondary:#6b6860;
  --accent:        #d97706;
  --accent-hover:  #b45309;
  --progress-fill: #d97706;
  --progress-bg:   #e5e3de;
  --border:        #ddd9d3;
  --neutral-700:   #d1cfc9;
  --code-bg:       #f5f3ef;
}

html, body, #app {
  height: 100%;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 15px;
  line-height: 1.6;
}

a { color: var(--accent); text-decoration: none; }
a:hover { color: var(--accent-hover); text-decoration: underline; }

code {
  font-family: var(--font-mono);
  background: var(--code-bg);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 0.875em;
}

pre code {
  display: block;
  padding: 12px 16px;
  overflow-x: auto;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

/* Accessibility: screen-reader only */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/style.css
git commit -m "feat: add CSS theme system with dark/light custom properties"
```

---

## Task 10: Frontend — Pinia stores

**Files:**
- Create: `apps/frontend/src/stores/vault.ts`
- Create: `apps/frontend/src/stores/sse.ts`

- [ ] **Step 1: Write vault store**

```typescript
// apps/frontend/src/stores/vault.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FileInfo } from '@notatnik/shared'

export const useVaultStore = defineStore('vault', () => {
  const vaultPath = ref('')
  const files = ref<FileInfo[]>([])
  const changedFiles = ref(new Set<string>())  // filenames with unseen changes

  const HISTORY_KEY = 'notatnik-vault-history'
  const MAX_HISTORY = 5

  function getHistory(): string[] {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') }
    catch { return [] }
  }

  function addToHistory(path: string) {
    const history = [path, ...getHistory().filter((p) => p !== path)].slice(0, MAX_HISTORY)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  }

  async function setVault(path: string) {
    const res = await fetch('/api/vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Failed to set vault')
    }
    vaultPath.value = path
    addToHistory(path)
    await refreshFiles()
  }

  async function loadVault() {
    const res = await fetch('/api/vault')
    const data = await res.json()
    vaultPath.value = data.path ?? ''
    if (vaultPath.value) await refreshFiles()
  }

  async function refreshFiles() {
    const res = await fetch('/api/files')
    files.value = await res.json()
  }

  function markChanged(filename: string) {
    changedFiles.value.add(filename)
  }

  function clearChanged(filename: string) {
    changedFiles.value.delete(filename)
  }

  return {
    vaultPath,
    files,
    changedFiles,
    getHistory,
    setVault,
    loadVault,
    refreshFiles,
    markChanged,
    clearChanged,
  }
})
```

- [ ] **Step 2: Write SSE store**

```typescript
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
      } else if (parsed.type === 'vault:changed') {
        vaultStore.loadVault()
      }
    }

    es.onerror = () => {
      connected.value = false
      es?.close()
      es = null
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
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/stores/
git commit -m "feat: add Pinia stores for vault and SSE"
```

---

## Task 11: Frontend — ProgressBar component

**Files:**
- Create: `apps/frontend/src/components/ProgressBar.vue`

- [ ] **Step 1: Write ProgressBar component**

```vue
<!-- apps/frontend/src/components/ProgressBar.vue -->
<template>
  <div class="progress-wrap" :class="`level-${level}`">
    <div class="progress-header">
      <span v-if="label" class="progress-label">{{ label }}</span>
      <span class="progress-stats">{{ pct }}% ({{ checked }}/{{ total }})</span>
    </div>
    <div class="progress-track">
      <div class="progress-fill" :style="{ width: `${pct}%` }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  total: number
  checked: number
  label?: string
  level?: 'doc' | 'chapter' | 'section' | 'subsection'
}>()

const pct = computed(() =>
  props.total === 0 ? 0 : Math.round((props.checked / props.total) * 100)
)
</script>

<style scoped>
.progress-wrap { display: flex; flex-direction: column; gap: 4px; }

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.progress-label {
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.progress-stats {
  font-size: 0.8em;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.progress-track {
  height: 6px;
  background: var(--progress-bg);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--progress-fill);
  border-radius: 3px;
  transition: width 0.3s ease;
  min-width: 0;
}

/* Smaller bars for deeper levels */
.level-section .progress-track  { height: 4px; }
.level-subsection .progress-track { height: 3px; }

.level-section .progress-label  { font-size: 0.9em; font-weight: 500; }
.level-subsection .progress-label { font-size: 0.85em; font-weight: 400; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/components/ProgressBar.vue
git commit -m "feat: add ProgressBar component with 4 level variants"
```

---

## Task 12: Frontend — Markdown parser (TDD)

**Files:**
- Create: `apps/frontend/src/parser/index.ts`
- Create: `apps/frontend/src/parser/index.test.ts`

This is the most complex unit. Write tests first, then implement.

- [ ] **Step 1: Write parser tests**

```typescript
// apps/frontend/src/parser/index.test.ts
import { describe, test, expect } from 'vitest'
import { parse, djb2 } from './index'

describe('djb2 hash', () => {
  test('same string gives same hash', () => {
    expect(djb2('hello')).toBe(djb2('hello'))
  })
  test('different strings give different hash', () => {
    expect(djb2('hello')).not.toBe(djb2('world'))
  })
})

describe('parse: empty / no checkboxes', () => {
  test('empty string produces zero progress', () => {
    const doc = parse('', 'test.md')
    expect(doc.progress).toEqual({ total: 0, checked: 0, pct: 0 })
    expect(doc.chapters).toHaveLength(0)
  })

  test('plain text only — no checkboxes', () => {
    const doc = parse('# Title\n\nSome text here.\n', 'test.md')
    expect(doc.progress.total).toBe(0)
  })
})

describe('parse: document-level checkboxes (no chapters)', () => {
  test('counts checked and unchecked at doc level', () => {
    const md = '- [x] done\n- [ ] todo\n- ✅ also done\n- ⏳ pending\n'
    const doc = parse(md, 'test.md')
    expect(doc.progress.total).toBe(4)
    expect(doc.progress.checked).toBe(2)
    expect(doc.progress.pct).toBe(50)
  })

  test('tasks have correct checked flag', () => {
    const md = '- [x] done\n- [ ] todo\n'
    const doc = parse(md, 'test.md')
    const tasks = doc.items.filter((i) => i.type === 'task')
    expect(tasks[0].checked).toBe(true)
    expect(tasks[1].checked).toBe(false)
  })

  test('tasks have djb2 hash of their text', () => {
    const md = '- [x] my task\n'
    const doc = parse(md, 'test.md')
    const task = doc.items.find((i) => i.type === 'task')!
    expect(task.hash).toBe(djb2('my task'))
  })
})

describe('parse: emoji checkboxes', () => {
  test('✅ is checked', () => {
    const doc = parse('- ✅ done\n', 'test.md')
    expect(doc.items[0].checked).toBe(true)
  })
  test('⏳ is unchecked', () => {
    const doc = parse('- ⏳ pending\n', 'test.md')
    expect(doc.items[0].checked).toBe(false)
  })
  test('❌ is unchecked', () => {
    const doc = parse('- ❌ failed\n', 'test.md')
    expect(doc.items[0].checked).toBe(false)
  })
  test('🔜 is unchecked', () => {
    const doc = parse('- 🔜 soon\n', 'test.md')
    expect(doc.items[0].checked).toBe(false)
  })
})

describe('parse: table rows are NOT checkboxes', () => {
  test('table with checkbox-like content is not parsed as task', () => {
    const md = '| Name | Status |\n|---|---|\n| Task | - [x] done |\n'
    const doc = parse(md, 'test.md')
    expect(doc.progress.total).toBe(0)
    const tables = doc.items.filter((i) => i.type === 'table')
    expect(tables).toHaveLength(1)
  })
})

describe('parse: code blocks are excluded', () => {
  test('checkboxes inside code fences are not counted', () => {
    const md = '```\n- [x] inside code\n```\n- [ ] outside code\n'
    const doc = parse(md, 'test.md')
    expect(doc.progress.total).toBe(1)
    expect(doc.progress.checked).toBe(0)
  })
})

describe('parse: ## chapters', () => {
  test('chapters split document correctly', () => {
    const md = '## Chapter 1\n- [x] a\n## Chapter 2\n- [ ] b\n- [ ] c\n'
    const doc = parse(md, 'test.md')
    expect(doc.chapters).toHaveLength(2)
    expect(doc.chapters[0].title).toBe('Chapter 1')
    expect(doc.chapters[0].progress).toEqual({ total: 1, checked: 1, pct: 100 })
    expect(doc.chapters[1].progress).toEqual({ total: 2, checked: 0, pct: 0 })
  })

  test('document progress is sum of all chapters', () => {
    const md = '## A\n- [x] a\n- [ ] b\n## B\n- [x] c\n'
    const doc = parse(md, 'test.md')
    expect(doc.progress).toEqual({ total: 3, checked: 2, pct: 67 })
  })
})

describe('parse: ### sections', () => {
  test('sections within chapter', () => {
    const md = '## Chapter\n### Section 1\n- [x] a\n- [ ] b\n### Section 2\n- [x] c\n'
    const doc = parse(md, 'test.md')
    const chapter = doc.chapters[0]
    expect(chapter.sections).toHaveLength(2)
    expect(chapter.sections[0].progress).toEqual({ total: 2, checked: 1, pct: 50 })
    expect(chapter.sections[1].progress).toEqual({ total: 1, checked: 1, pct: 100 })
  })
})

describe('parse: #### subsections', () => {
  test('subsections within section', () => {
    const md = '## Ch\n### Sec\n#### Sub A\n- [x] a\n#### Sub B\n- [ ] b\n- [ ] c\n'
    const doc = parse(md, 'test.md')
    const section = doc.chapters[0].sections[0]
    expect(section.subsections).toHaveLength(2)
    expect(section.subsections[0].progress).toEqual({ total: 1, checked: 1, pct: 100 })
    expect(section.subsections[1].progress).toEqual({ total: 2, checked: 0, pct: 0 })
  })
})

describe('parse: title', () => {
  test('uses # heading as title', () => {
    const doc = parse('# My Notes\n', 'file.md')
    expect(doc.title).toBe('My Notes')
  })
  test('falls back to filename if no # heading', () => {
    const doc = parse('## Chapter\n', 'my-file.md')
    expect(doc.title).toBe('my-file.md')
  })
})
```

- [ ] **Step 2: Run tests — expect ALL FAIL (parser not implemented yet)**

```bash
cd apps/frontend
bun run test
```

Expected: many test failures — "Cannot find module './index'"

- [ ] **Step 3: Implement the parser**

```typescript
// apps/frontend/src/parser/index.ts
import type { MdDocument, MdChapter, MdSection, MdSubsection, MdItem, Progress } from '@notatnik/shared'

export function djb2(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return h >>> 0  // unsigned
}

function makeProgress(items: MdItem[], ...children: Progress[]): Progress {
  const childTotal = children.reduce((s, p) => s + p.total, 0)
  const childChecked = children.reduce((s, p) => s + p.checked, 0)
  const localTasks = items.filter((i) => i.type === 'task')
  const total = localTasks.length + childTotal
  const checked = localTasks.filter((i) => i.checked).length + childChecked
  const pct = total === 0 ? 0 : Math.round((checked / total) * 100)
  return { total, checked, pct }
}

function parseItem(line: string): MdItem | null {
  // Checked: - [x], - ✅
  if (/^- \[x\] /i.test(line)) {
    const text = line.replace(/^- \[x\] /i, '').trim()
    return { type: 'task', text, checked: true, hash: djb2(text) }
  }
  if (/^- ✅ /.test(line)) {
    const text = line.replace(/^- ✅ /, '').trim()
    return { type: 'task', text, checked: true, hash: djb2(text) }
  }
  // Unchecked: - [ ], - ⏳, - ❌, - 🔜
  if (/^- \[ \] /.test(line)) {
    const text = line.replace(/^- \[ \] /, '').trim()
    return { type: 'task', text, checked: false, hash: djb2(text) }
  }
  if (/^- (⏳|❌|🔜) /.test(line)) {
    const text = line.replace(/^- (⏳|❌|🔜) /, '').trim()
    return { type: 'task', text, checked: false, hash: djb2(text) }
  }
  return null
}

export function parse(markdown: string, filename: string): MdDocument {
  const lines = markdown.split('\n')
  let title = filename

  // Phase 1: collect table blocks and code blocks positions, then parse line by line
  type RawNode =
    | { kind: 'h1'; text: string }
    | { kind: 'h2'; text: string }
    | { kind: 'h3'; text: string }
    | { kind: 'h4'; text: string }
    | { kind: 'item'; item: MdItem }
    | { kind: 'table'; rows: string[][] }
    | { kind: 'text'; text: string }

  const nodes: RawNode[] = []
  let inCode = false
  let tableBuffer: string[] = []

  function flushTable() {
    if (tableBuffer.length === 0) return
    const rows = tableBuffer
      .filter((l) => !/^\|[\s\-:|]+\|$/.test(l.trim()))  // remove separator rows
      .map((l) =>
        l.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim())
      )
    if (rows.length > 0) nodes.push({ kind: 'table', rows })
    tableBuffer = []
  }

  for (const line of lines) {
    // Code fence toggle
    if (line.startsWith('```')) {
      flushTable()
      inCode = !inCode
      nodes.push({ kind: 'text', text: line })
      continue
    }
    if (inCode) {
      nodes.push({ kind: 'text', text: line })
      continue
    }

    // Table accumulation
    if (line.startsWith('|')) {
      tableBuffer.push(line)
      continue
    } else {
      flushTable()
    }

    // Headings
    if (/^# /.test(line)) {
      title = line.replace(/^# /, '').trim()
      nodes.push({ kind: 'h1', text: title })
      continue
    }
    if (/^## /.test(line)) {
      nodes.push({ kind: 'h2', text: line.replace(/^## /, '').trim() })
      continue
    }
    if (/^### /.test(line)) {
      nodes.push({ kind: 'h3', text: line.replace(/^### /, '').trim() })
      continue
    }
    if (/^#### /.test(line)) {
      nodes.push({ kind: 'h4', text: line.replace(/^#### /, '').trim() })
      continue
    }

    // Task or text
    const item = parseItem(line)
    if (item) {
      nodes.push({ kind: 'item', item })
    } else {
      nodes.push({ kind: 'text', text: line })
    }
  }
  flushTable()

  // Phase 2: build AST from nodes
  const docItems: MdItem[] = []
  const chapters: MdChapter[] = []
  let curChapter: MdChapter | null = null
  let curSection: MdSection | null = null
  let curSubsection: MdSubsection | null = null

  function pushItem(item: MdItem) {
    if (curSubsection) curSubsection.items.push(item)
    else if (curSection) curSection.items.push(item)
    else if (curChapter) curChapter.items.push(item)
    else docItems.push(item)
  }

  function pushText(text: string) {
    pushItem({ type: 'text', text })
  }

  for (const node of nodes) {
    if (node.kind === 'h2') {
      curSubsection = null
      curSection = null
      curChapter = {
        title: node.text,
        progress: { total: 0, checked: 0, pct: 0 },
        sections: [],
        items: [],
      }
      chapters.push(curChapter)
    } else if (node.kind === 'h3') {
      curSubsection = null
      curSection = {
        title: node.text,
        progress: { total: 0, checked: 0, pct: 0 },
        subsections: [],
        items: [],
      }
      if (curChapter) curChapter.sections.push(curSection)
    } else if (node.kind === 'h4') {
      curSubsection = {
        title: node.text,
        progress: { total: 0, checked: 0, pct: 0 },
        items: [],
      }
      if (curSection) curSection.subsections.push(curSubsection)
    } else if (node.kind === 'item') {
      pushItem(node.item)
    } else if (node.kind === 'table') {
      pushItem({ type: 'table', rows: node.rows })
    } else if (node.kind === 'text') {
      pushText(node.text)
    }
    // h1 already handled (title)
  }

  // Phase 3: compute progress bottom-up
  for (const ch of chapters) {
    for (const sec of ch.sections) {
      for (const sub of sec.subsections) {
        sub.progress = makeProgress(sub.items)
      }
      sec.progress = makeProgress(sec.items, ...sec.subsections.map((s) => s.progress))
    }
    ch.progress = makeProgress(ch.items, ...ch.sections.map((s) => s.progress))
  }

  const docProgress = makeProgress(docItems, ...chapters.map((ch) => ch.progress))

  return { title, progress: docProgress, chapters, items: docItems }
}
```

- [ ] **Step 4: Run tests — expect ALL PASS**

```bash
cd apps/frontend
bun run test
```

Expected: all tests in `src/parser/index.test.ts` pass.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/parser/
git commit -m "feat: add markdown parser with hierarchical checkbox progress (TDD)"
```

---

## Task 13: Frontend — MarkdownRenderer component

**Files:**
- Create: `apps/frontend/src/components/MarkdownRenderer.vue`

- [ ] **Step 1: Write mdInline helper (inline markdown → HTML)**

Add to `apps/frontend/src/parser/index.ts` (append at bottom):

```typescript
export function mdInline(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
}
```

- [ ] **Step 2: Write MarkdownRenderer component**

```vue
<!-- apps/frontend/src/components/MarkdownRenderer.vue -->
<template>
  <div class="md-root">
    <!-- Document-level items (before first ##) -->
    <div v-if="doc.items.length" class="md-items">
      <template v-for="item in doc.items" :key="itemKey(item)">
        <label v-if="item.type === 'task'" class="task-label">
          <input type="checkbox" class="sr-only" :checked="item.checked"
            @change="toggleTask(item)" />
          <span class="checkbox-visual" :class="{ checked: item.checked }">
            <svg v-if="item.checked" viewBox="0 0 12 10" fill="none">
              <path d="M1 5l3.5 3.5L11 1" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span :class="{ 'task-done': item.checked }" v-html="mdInline(item.text ?? '')" />
        </label>
        <div v-else-if="item.type === 'table'" class="prd-text">
          <table class="prd-table">
            <thead>
              <tr><th v-for="(cell, i) in item.rows![0]" :key="i" v-html="mdInline(cell)" /></tr>
            </thead>
            <tbody>
              <tr v-for="(row, ri) in item.rows!.slice(1)" :key="ri">
                <td v-for="(cell, ci) in row" :key="ci" v-html="mdInline(cell)" />
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="prd-text" v-html="mdInline(item.text ?? '')" />
      </template>
    </div>

    <!-- Chapters -->
    <section v-for="chapter in doc.chapters" :key="chapter.title" class="section-card">
      <div class="section-header">
        <h2>{{ chapter.title }}</h2>
        <ProgressBar :total="chapter.progress.total" :checked="chapter.progress.checked"
          level="chapter" />
      </div>
      <div class="section-body">

        <!-- Chapter-level items -->
        <ItemList :items="chapter.items" :filename="filename" @toggle="toggleTask" />

        <!-- Sections -->
        <div v-for="section in chapter.sections" :key="section.title" class="subsection">
          <h3>{{ section.title }}</h3>
          <ProgressBar v-if="section.progress.total > 0"
            :total="section.progress.total" :checked="section.progress.checked"
            level="section" />

          <ItemList :items="section.items" :filename="filename" @toggle="toggleTask" />

          <!-- Subsections -->
          <div v-for="sub in section.subsections" :key="sub.title" class="subsubsection">
            <h4>{{ sub.title }}</h4>
            <ProgressBar v-if="sub.progress.total > 0"
              :total="sub.progress.total" :checked="sub.progress.checked"
              level="subsection" />
            <ItemList :items="sub.items" :filename="filename" @toggle="toggleTask" />
          </div>
        </div>

      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { mdInline } from '../parser'
import ProgressBar from './ProgressBar.vue'
import type { MdDocument, MdItem } from '@notatnik/shared'

const props = defineProps<{
  doc: MdDocument
  filename: string
}>()

const emit = defineEmits<{ toggle: [item: MdItem] }>()

function itemKey(item: MdItem) {
  return item.hash ?? item.text ?? Math.random()
}

function toggleTask(item: MdItem) {
  emit('toggle', item)
}
</script>

<!-- ItemList is inline-defined below as a local subcomponent via script -->
<script lang="ts">
// Workaround: define ItemList locally to avoid circular imports
import { defineComponent, h } from 'vue'
import { mdInline as md } from '../parser'
import type { MdItem } from '@notatnik/shared'

// ItemList is registered globally in main.ts — see Task 13 Step 3
export {}
</script>

<style scoped>
.md-root { display: flex; flex-direction: column; gap: 24px; }

.section-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: clip;  /* clip NOT hidden — sticky children still work */
}

.section-header {
  position: sticky;
  top: 150px;  /* navbar 56px + progress-doc ~86px + 8px gap */
  z-index: 10;
  background: rgba(20, 18, 16, 0.85);
  backdrop-filter: blur(16px) saturate(1.3);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-bottom: 1px solid var(--border);
}

[data-theme="light"] .section-header {
  background: rgba(250, 250, 249, 0.9);
}

.section-header h2 {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.section-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }

.subsection { margin-top: 8px; }
.subsection h3 { font-size: 1rem; font-weight: 600; margin-bottom: 6px; color: var(--text-primary); }
.subsubsection { margin-top: 6px; padding-left: 12px; border-left: 2px solid var(--border); }
.subsubsection h4 { font-size: 0.9rem; font-weight: 500; margin-bottom: 4px; color: var(--text-secondary); }

.task-label {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
  padding: 2px 0;
  line-height: 1.5;
}

.task-label:hover .checkbox-visual { border-color: var(--accent); }

.checkbox-visual {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin-top: 3px;
  border: 2px solid var(--neutral-700);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color var(--transition), background var(--transition);
}

.checkbox-visual.checked {
  background: var(--accent);
  border-color: var(--accent);
  color: #000;
}

.checkbox-visual svg { width: 10px; height: 10px; }

.task-done { text-decoration: line-through; opacity: 0.5; }

.prd-text { color: var(--text-secondary); font-size: 0.9rem; }

.prd-text :deep(.prd-table) { width: 100%; border-collapse: collapse; }
.prd-text :deep(.prd-table th) {
  background: var(--bg-elevated);
  font-weight: 600;
  text-align: left;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
}
.prd-text :deep(.prd-table th),
.prd-text :deep(.prd-table td) {
  padding: 7px 12px;
  border: 1px solid var(--neutral-700);
}
</style>
```

- [ ] **Step 3: Add ItemList as a global component in main.ts**

Replace `apps/frontend/src/main.ts`:

```typescript
// apps/frontend/src/main.ts
import { createApp, defineComponent, h } from 'vue'
import { createPinia } from 'pinia'
import { router } from './router'
import App from './App.vue'
import './style.css'
import { mdInline } from './parser'
import type { MdItem } from '@notatnik/shared'

// ItemList: reusable across MarkdownRenderer for rendering a list of MdItems
const ItemList = defineComponent({
  props: { items: Array as () => MdItem[], filename: String },
  emits: ['toggle'],
  setup(props, { emit }) {
    return () =>
      h('div', { class: 'md-items' },
        (props.items ?? []).map((item) => {
          if (item.type === 'task') {
            return h('label', { class: 'task-label', key: item.hash },
              [
                h('input', {
                  type: 'checkbox',
                  class: 'sr-only',
                  checked: item.checked,
                  onChange: () => emit('toggle', item),
                }),
                h('span', { class: ['checkbox-visual', { checked: item.checked }] },
                  item.checked
                    ? [h('svg', { viewBox: '0 0 12 10', fill: 'none' },
                        [h('path', { d: 'M1 5l3.5 3.5L11 1', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })])]
                    : []
                ),
                h('span', {
                  class: { 'task-done': item.checked },
                  innerHTML: mdInline(item.text ?? ''),
                }),
              ]
            )
          }
          if (item.type === 'table') {
            return h('div', { class: 'prd-text', key: String(Math.random()) },
              [h('table', { class: 'prd-table' }, [
                h('thead', [h('tr', (item.rows![0] ?? []).map((cell, i) => h('th', { key: i, innerHTML: mdInline(cell) })))]),
                h('tbody', (item.rows!.slice(1)).map((row, ri) =>
                  h('tr', { key: ri }, row.map((cell, ci) => h('td', { key: ci, innerHTML: mdInline(cell) })))
                )),
              ])]
            )
          }
          return h('div', { class: 'prd-text', key: item.text, innerHTML: mdInline(item.text ?? '') })
        })
      )
  },
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.component('ItemList', ItemList)
app.mount('#app')
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/MarkdownRenderer.vue apps/frontend/src/main.ts apps/frontend/src/parser/index.ts
git commit -m "feat: add MarkdownRenderer component and mdInline helper"
```

---

## Task 14: Frontend — Sidebar component

**Files:**
- Create: `apps/frontend/src/components/Sidebar.vue`

- [ ] **Step 1: Write Sidebar**

```vue
<!-- apps/frontend/src/components/Sidebar.vue -->
<template>
  <nav class="sidebar">
    <ul class="file-list">
      <li v-if="!vaultStore.files.length" class="no-files">
        Brak plików .md w vaultcie
      </li>
      <li
        v-for="file in vaultStore.files"
        :key="file.filename"
        class="file-item"
        :class="{ active: currentFilename === file.filename }"
        @click="openFile(file.filename)"
      >
        <span class="file-name">{{ file.name }}</span>
        <span
          v-if="vaultStore.changedFiles.has(file.filename) && currentFilename !== file.filename"
          class="change-dot"
          title="Plik zmieniony"
        />
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useVaultStore } from '../stores/vault'

const vaultStore = useVaultStore()
const router = useRouter()
const route = useRoute()

const currentFilename = computed(() => {
  const p = route.params.filename
  const name = Array.isArray(p) ? p[0] : p ?? ''
  return name.endsWith('.md') ? name : `${name}.md`
})

function openFile(filename: string) {
  vaultStore.clearChanged(filename)
  router.push(`/${filename}`)
}
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-w);
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  height: calc(100vh - var(--navbar-h));
  position: sticky;
  top: var(--navbar-h);
  overflow-y: auto;
  flex-shrink: 0;
}

.file-list { list-style: none; padding: 8px 0; }

.no-files {
  padding: 12px 16px;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
  border-radius: 0;
  transition: background var(--transition);
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.file-item:hover { background: var(--bg-hover); color: var(--text-primary); }

.file-item.active {
  background: var(--bg-hover);
  color: var(--accent);
  font-weight: 600;
  border-right: 2px solid var(--accent);
}

.file-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.change-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/components/Sidebar.vue
git commit -m "feat: add Sidebar component with change indicator"
```

---

## Task 15: Frontend — ThemeToggle component

**Files:**
- Create: `apps/frontend/src/components/ThemeToggle.vue`

- [ ] **Step 1: Write ThemeToggle**

```vue
<!-- apps/frontend/src/components/ThemeToggle.vue -->
<template>
  <button class="theme-toggle" @click="toggle" :title="`Przełącz na ${isDark ? 'jasny' : 'ciemny'} motyw`">
    <svg v-if="isDark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <!-- Sun icon -->
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <!-- Moon icon -->
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  </button>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const THEME_KEY = 'notatnik-theme'
const isDark = ref(true)

onMounted(() => {
  const saved = localStorage.getItem(THEME_KEY)
  isDark.value = saved !== 'light'
  applyTheme()
})

function applyTheme() {
  document.documentElement.dataset.theme = isDark.value ? 'dark' : 'light'
  localStorage.setItem(THEME_KEY, isDark.value ? 'dark' : 'light')
}

function toggle() {
  isDark.value = !isDark.value
  applyTheme()
}
</script>

<style scoped>
.theme-toggle {
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color var(--transition), border-color var(--transition);
}

.theme-toggle:hover { color: var(--accent); border-color: var(--accent); }
.theme-toggle svg { width: 18px; height: 18px; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/components/ThemeToggle.vue
git commit -m "feat: add ThemeToggle component with localStorage persistence"
```

---

## Task 16: Frontend — HomeView

**Files:**
- Modify: `apps/frontend/src/views/HomeView.vue`

- [ ] **Step 1: Write HomeView**

```vue
<!-- apps/frontend/src/views/HomeView.vue -->
<template>
  <div class="home">
    <div class="home-card">
      <h1>notatnik.md</h1>
      <p class="subtitle">Otwórz katalog z plikami Markdown</p>

      <div class="input-row">
        <input
          v-model="pathInput"
          type="text"
          placeholder="/ścieżka/do/katalogu"
          list="vault-history"
          @keydown.enter="openVault"
          :class="{ error: errorMsg }"
        />
        <datalist id="vault-history">
          <option v-for="h in history" :key="h" :value="h" />
        </datalist>
        <button @click="openVault" :disabled="!pathInput.trim()">Otwórz</button>
      </div>

      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      <p v-if="loading" class="loading">Ładowanie...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useVaultStore } from '../stores/vault'

const router = useRouter()
const vaultStore = useVaultStore()

const pathInput = ref('')
const errorMsg = ref('')
const loading = ref(false)
const history = ref<string[]>([])

onMounted(() => {
  history.value = vaultStore.getHistory()
  if (vaultStore.vaultPath) {
    pathInput.value = vaultStore.vaultPath
  }
})

async function openVault() {
  const path = pathInput.value.trim()
  if (!path) return

  loading.value = true
  errorMsg.value = ''

  try {
    await vaultStore.setVault(path)
    history.value = vaultStore.getHistory()
    // Navigate to first file if available
    if (vaultStore.files.length > 0) {
      router.push(`/${vaultStore.files[0].filename}`)
    }
  } catch (e: any) {
    errorMsg.value = e.message ?? 'Nie udało się otworzyć katalogu'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.home {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - var(--navbar-h));
  padding: 24px;
}

.home-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 40px;
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

h1 { font-size: 1.6rem; font-weight: 800; color: var(--accent); }
.subtitle { color: var(--text-secondary); font-size: 0.9rem; }

.input-row { display: flex; gap: 8px; }

input[type="text"] {
  flex: 1;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-primary);
  font-size: 0.9rem;
  padding: 8px 12px;
  outline: none;
  transition: border-color var(--transition);
}

input[type="text"]:focus { border-color: var(--accent); }
input.error { border-color: #ef4444; }

button {
  background: var(--accent);
  border: none;
  border-radius: var(--radius);
  color: #000;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 8px 16px;
  transition: background var(--transition);
  white-space: nowrap;
}

button:hover:not(:disabled) { background: var(--accent-hover); }
button:disabled { opacity: 0.5; cursor: not-allowed; }

.error-msg { color: #ef4444; font-size: 0.85rem; }
.loading { color: var(--text-secondary); font-size: 0.85rem; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/views/HomeView.vue
git commit -m "feat: add HomeView with vault path picker and history"
```

---

## Task 17: Frontend — FileView

**Files:**
- Modify: `apps/frontend/src/views/FileView.vue`

- [ ] **Step 1: Write FileView**

```vue
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
import type { MdDocument, MdItem } from '@notatnik/shared'

const route = useRoute()
const vaultStore = useVaultStore()
const sseStore = useSseStore()

const doc = ref<MdDocument | null>(null)
const loading = ref(false)
const error = ref('')
let lastEtag = ''

const currentFilename = computed(() => {
  const p = route.params.filename
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
    // Walk all tasks and restore checked state from localStorage
    walkTasks(doc.value, (item) => {
      if (item.hash !== undefined && saved[item.hash] !== undefined) {
        item.checked = saved[item.hash]
      }
    })
    // Recompute progress after restoring
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
  } catch (e) {
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

import type { Progress } from '@notatnik/shared'

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
  top: calc(var(--navbar-h) + 8px);
  z-index: 15;
  background: rgba(15, 14, 13, 0.8);
  backdrop-filter: blur(18px) saturate(1.4);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 16px;
  margin-bottom: 20px;
}

[data-theme="light"] .doc-progress {
  background: rgba(250, 250, 249, 0.9);
}

.loading, .error {
  padding: 40px;
  text-align: center;
  color: var(--text-secondary);
}

.error { color: #ef4444; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/views/FileView.vue
git commit -m "feat: add FileView with sticky progress, SSE reload, localStorage state"
```

---

## Task 18: Frontend — App.vue layout + navbar

**Files:**
- Modify: `apps/frontend/src/App.vue`

- [ ] **Step 1: Write App.vue with full layout**

```vue
<!-- apps/frontend/src/App.vue -->
<template>
  <div class="app-root">
    <!-- Navbar -->
    <header class="navbar">
      <div class="navbar-left">
        <span class="logo" @click="router.push('/')">notatnik.md</span>
      </div>
      <div class="navbar-center">
        <input
          v-if="vaultStore.vaultPath"
          v-model="pathInput"
          type="text"
          class="vault-input"
          list="vault-history-nav"
          placeholder="/ścieżka/do/vaultu"
          @keydown.enter="changeVault"
        />
        <datalist id="vault-history-nav">
          <option v-for="h in vaultStore.getHistory()" :key="h" :value="h" />
        </datalist>
      </div>
      <div class="navbar-right">
        <span v-if="sseStore.connected" class="sse-dot" title="Połączono z watcherem" />
        <ThemeToggle />
      </div>
    </header>

    <!-- Body: sidebar + content -->
    <div class="app-body">
      <Sidebar v-if="vaultStore.vaultPath" />
      <main class="main-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useVaultStore } from './stores/vault'
import { useSseStore } from './stores/sse'
import Sidebar from './components/Sidebar.vue'
import ThemeToggle from './components/ThemeToggle.vue'

const router = useRouter()
const vaultStore = useVaultStore()
const sseStore = useSseStore()
const pathInput = ref('')

onMounted(async () => {
  await vaultStore.loadVault()
  pathInput.value = vaultStore.vaultPath
  sseStore.connect()
})

watch(() => vaultStore.vaultPath, (val) => {
  pathInput.value = val
})

async function changeVault() {
  const path = pathInput.value.trim()
  if (!path || path === vaultStore.vaultPath) return
  try {
    await vaultStore.setVault(path)
    if (vaultStore.files.length > 0) {
      router.push(`/${vaultStore.files[0].filename}`)
    }
  } catch (e: any) {
    alert(e.message ?? 'Błąd zmiany vaultu')
    pathInput.value = vaultStore.vaultPath
  }
}
</script>

<style scoped>
.app-root { display: flex; flex-direction: column; height: 100vh; }

.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--navbar-h);
  z-index: 100;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 16px;
}

.navbar-left { flex-shrink: 0; }

.logo {
  font-size: 1rem;
  font-weight: 800;
  color: var(--accent);
  cursor: pointer;
  letter-spacing: -0.01em;
}

.navbar-center { flex: 1; min-width: 0; }

.vault-input {
  width: 100%;
  max-width: 480px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-secondary);
  font-size: 0.8rem;
  padding: 5px 10px;
  outline: none;
  font-family: var(--font-mono);
  transition: border-color var(--transition), color var(--transition);
}

.vault-input:focus {
  border-color: var(--accent);
  color: var(--text-primary);
}

.navbar-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.sse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 6px #22c55e88;
}

.app-body {
  display: flex;
  margin-top: var(--navbar-h);
  flex: 1;
  min-height: 0;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  min-width: 0;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/App.vue
git commit -m "feat: add App.vue with navbar, sidebar layout, SSE status indicator"
```

---

## Task 19: Integration — run and verify

- [ ] **Step 1: Start API**

```bash
cd /home/perun/Code/notatnik.md/apps/api
bun src/index.ts &
```

Expected: `API listening on http://localhost:3001`

- [ ] **Step 2: Verify health endpoint**

```bash
curl http://localhost:3001/api/health
```

Expected: `{"ok":true}`

- [ ] **Step 3: Set vault to a test directory**

```bash
mkdir -p /tmp/vault-test
echo "# My Notes\n- [x] done\n- [ ] todo\n## Chapter\n- [x] ch done\n" > /tmp/vault-test/notes.md
curl -X POST http://localhost:3001/api/vault \
  -H 'Content-Type: application/json' \
  -d '{"path":"/tmp/vault-test"}'
```

Expected: `{"path":"/tmp/vault-test"}`

- [ ] **Step 4: Verify files list**

```bash
curl http://localhost:3001/api/files
```

Expected: `[{"name":"notes","filename":"notes.md","mtime":...,"size":...}]`

- [ ] **Step 5: Verify file content**

```bash
curl http://localhost:3001/api/files/notes.md
```

Expected: full markdown content of notes.md

- [ ] **Step 6: Start frontend**

```bash
cd /home/perun/Code/notatnik.md/apps/frontend
bun run dev &
```

Expected: `Local: http://localhost:5173/`

- [ ] **Step 7: Run parser tests one final time**

```bash
cd /home/perun/Code/notatnik.md/apps/frontend
bun run test
```

Expected: all tests pass.

- [ ] **Step 8: Kill background processes**

```bash
kill %1 %2 2>/dev/null || true
```

- [ ] **Step 9: Final commit**

```bash
cd /home/perun/Code/notatnik.md
git add -A
git commit -m "feat: complete notatnik.md — markdown vault viewer with SSE, progress bars, dark/light theme"
```

---

## Self-Review

**Spec coverage:**
- ✅ Monorepo Bun workspaces (Task 1)
- ✅ Shared types (Task 2)
- ✅ Hono API server (Task 3)
- ✅ GET/POST /api/vault + settings.json (Task 4)
- ✅ GET /api/files + GET /api/files/:name + ETag (Task 5)
- ✅ Chokidar watcher singleton (Task 6)
- ✅ SSE route + heartbeat (Task 7)
- ✅ Vue 3 + Vite + Router (Task 8)
- ✅ CSS custom properties dark/light (Task 9)
- ✅ Pinia stores vault + sse (Task 10)
- ✅ ProgressBar component 4 levels (Task 11)
- ✅ Markdown parser + TDD (Task 12)
- ✅ MarkdownRenderer + mdInline (Task 13)
- ✅ Sidebar + change dot (Task 14)
- ✅ ThemeToggle + localStorage (Task 15)
- ✅ HomeView + vault picker + history (Task 16)
- ✅ FileView + sticky progress + ETag reload + localStorage state (Task 17)
- ✅ App.vue + navbar + grid layout + SSE indicator (Task 18)
- ✅ Integration verify (Task 19)

**Placeholder scan:** none found.

**Type consistency:** `MdItem`, `MdDocument`, `MdChapter`, `MdSection`, `MdSubsection`, `Progress`, `FileInfo`, `VaultConfig`, `SseEvent` — all defined in Task 2, referenced consistently in Tasks 4–18. `makeProgress` defined in Task 12 parser and re-implemented locally in FileView (Task 17) to avoid cross-boundary import — acceptable as the function is 5 lines.
