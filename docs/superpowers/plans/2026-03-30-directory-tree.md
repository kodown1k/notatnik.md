# Directory Tree Sidebar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat `.md` file list in Sidebar with a recursive directory tree showing subdirectories and `.md` files.

**Architecture:** `GET /api/files` returns a full `TreeNode[]` tree (dirs with children, files with metadata). The watcher becomes recursive. The frontend Sidebar renders the tree with collapsible directories via a new `TreeItem.vue` component.

**Tech Stack:** Bun + Hono (API), Vue 3 + Pinia (frontend), `bun:test` (tests)

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `packages/shared/types.ts` | Modify | `FileInfo` → `TreeNode` |
| `apps/api/src/routes/files.ts` | Modify | `GET /` returns tree; `GET /*` handles subdirs |
| `apps/api/src/watcher.ts` | Modify | `depth: 0` → recursive; emit relative paths |
| `apps/api/src/routes/files.test.ts` | Modify | New tests for tree shape and nested file fetch |
| `apps/frontend/src/stores/vault.ts` | Modify | `files: FileInfo[]` → `tree: TreeNode[]` |
| `apps/frontend/src/router/index.ts` | Modify | `/:filename` → `/:path(.*)` |
| `apps/frontend/src/views/FileView.vue` | Modify | `route.params.path` instead of `route.params.filename` |
| `apps/frontend/src/App.vue` | Modify | First file from tree instead of `files[0]` |
| `apps/frontend/src/components/TreeItem.vue` | Create | Recursive tree node (dir/file) |
| `apps/frontend/src/components/Sidebar.vue` | Modify | Render `tree` using `TreeItem` |

---

### Task 1: Replace `FileInfo` with `TreeNode` in shared types

**Files:**
- Modify: `packages/shared/types.ts`

- [ ] **Step 1: Update `packages/shared/types.ts`**

Replace the `FileInfo` interface with `TreeNode`:

```ts
// packages/shared/types.ts

export interface TreeNode {
  type: 'file' | 'dir'
  name: string           // display name (without .md for files)
  path: string           // relative path from vault root, e.g. "docs/notes.md" or "docs"
  filename?: string      // only for type=file: with .md extension
  mtime?: number         // only for type=file
  size?: number          // only for type=file
  children?: TreeNode[]  // only for type=dir, sorted: dirs first, then files alphabetically
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
  text?: string
  checked?: boolean
  hash?: number
  rows?: string[][]
  lang?: string
  code?: string
}

export interface MdSubsection {
  title: string
  progress: Progress
  items: MdItem[]
}

export interface MdSection {
  title: string
  progress: Progress
  subsections: MdSubsection[]
  items: MdItem[]
}

export interface MdChapter {
  title: string
  progress: Progress
  sections: MdSection[]
  items: MdItem[]
}

export interface MdDocument {
  title: string
  progress: Progress
  chapters: MdChapter[]
  items: MdItem[]
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/types.ts
git commit -m "types: replace FileInfo with TreeNode"
```

---

### Task 2: Update API — tree endpoint and nested file fetch

**Files:**
- Modify: `apps/api/src/routes/files.ts`

- [ ] **Step 1: Rewrite `apps/api/src/routes/files.ts`**

```ts
// apps/api/src/routes/files.ts
import { Hono } from 'hono'
import { readdirSync, readFileSync, statSync, existsSync, realpathSync } from 'fs'
import { join, resolve, relative } from 'path'
import { getVaultPath } from './vault'
import type { TreeNode } from '@notatnik/shared'

export const filesRoutes = new Hono()

// Security middleware: reject any request with directory traversal in path
filesRoutes.use('/*', async (c, next) => {
  if (c.req.path.includes('..')) {
    return c.json({ error: 'invalid filename' }, 400)
  }
  return next()
})

function buildTree(dirPath: string, vaultPath: string): TreeNode[] {
  let entries
  try {
    entries = readdirSync(dirPath, { withFileTypes: true })
  } catch {
    return []
  }

  const dirs: TreeNode[] = []
  const files: TreeNode[] = []

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)
    const relPath = relative(vaultPath, fullPath)

    if (entry.isDirectory()) {
      const children = buildTree(fullPath, vaultPath)
      if (children.length > 0) {
        dirs.push({ type: 'dir', name: entry.name, path: relPath, children })
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const stat = statSync(fullPath)
      files.push({
        type: 'file',
        name: entry.name.replace(/\.md$/, ''),
        path: relPath,
        filename: relPath,
        mtime: stat.mtimeMs,
        size: stat.size,
      })
    }
  }

  dirs.sort((a, b) => a.name.localeCompare(b.name))
  files.sort((a, b) => a.name.localeCompare(b.name))
  return [...dirs, ...files]
}

filesRoutes.get('/', (c) => {
  const vaultPath = getVaultPath()
  if (!vaultPath || !existsSync(vaultPath)) {
    return c.json([] as TreeNode[])
  }
  return c.json(buildTree(vaultPath, vaultPath))
})

filesRoutes.get('/*', (c) => {
  const vaultPath = getVaultPath()
  if (!vaultPath) {
    return c.json({ error: 'vault not configured' }, 503)
  }

  // Extract relative path: remove leading "/"
  const relPath = c.req.path.slice(1)
  if (!relPath) {
    return c.json({ error: 'invalid filename' }, 400)
  }

  const filePath = join(vaultPath, relPath.endsWith('.md') ? relPath : `${relPath}.md`)

  // Verify resolved path stays within vault
  const resolvedVault = resolve(vaultPath)
  const resolvedFile = resolve(filePath)
  if (!resolvedFile.startsWith(resolvedVault + '/')) {
    return c.json({ error: 'invalid filename' }, 400)
  }

  if (!existsSync(filePath)) {
    return c.json({ error: 'not found' }, 404)
  }

  // Resolve symlinks and re-verify
  let realFilePath: string
  let realVaultPath: string
  try {
    realFilePath = realpathSync(filePath)
    realVaultPath = realpathSync(vaultPath)
  } catch {
    return c.json({ error: 'not found' }, 404)
  }
  if (!realFilePath.startsWith(realVaultPath + '/')) {
    return c.json({ error: 'invalid filename' }, 400)
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

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/files.ts
git commit -m "api: GET /files returns TreeNode tree, /*  handles nested paths"
```

---

### Task 3: Update watcher — recursive, relative paths

**Files:**
- Modify: `apps/api/src/watcher.ts`

- [ ] **Step 1: Rewrite `apps/api/src/watcher.ts`**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/watcher.ts
git commit -m "watcher: watch recursively, emit relative paths"
```

---

### Task 4: Update API tests

**Files:**
- Modify: `apps/api/src/routes/files.test.ts`

- [ ] **Step 1: Rewrite `apps/api/src/routes/files.test.ts`**

```ts
// apps/api/src/routes/files.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { testClient } from 'hono/testing'
import { Hono } from 'hono'
import { filesRoutes } from './files'
import { setVaultPath } from './vault'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const testDir = join(tmpdir(), 'notatnik-test-' + Date.now())
const subDir = join(testDir, 'subdir')

beforeAll(() => {
  mkdirSync(testDir, { recursive: true })
  mkdirSync(subDir, { recursive: true })
  writeFileSync(join(testDir, 'alpha.md'), '# Alpha\n- [x] done\n- [ ] todo\n')
  writeFileSync(join(testDir, 'beta.md'), '# Beta\n')
  writeFileSync(join(testDir, 'notmd.txt'), 'ignored')
  writeFileSync(join(subDir, 'gamma.md'), '# Gamma\n')
  setVaultPath(testDir)
})

afterAll(() => rmSync(testDir, { recursive: true }))

const app = new Hono()
app.route('/api/files', filesRoutes)
const client = testClient(app)

describe('files routes', () => {
  test('GET /api/files returns tree with dirs first, then files', async () => {
    const res = await client.api.files.$get()
    const tree = await res.json() as any[]
    // top level: dir "subdir" first, then files "alpha", "beta"
    expect(tree[0].type).toBe('dir')
    expect(tree[0].name).toBe('subdir')
    expect(tree[1].type).toBe('file')
    expect(tree[1].name).toBe('alpha')
    expect(tree[2].type).toBe('file')
    expect(tree[2].name).toBe('beta')
  })

  test('GET /api/files returns dir with children', async () => {
    const res = await client.api.files.$get()
    const tree = await res.json() as any[]
    const subdir = tree[0]
    expect(subdir.children).toHaveLength(1)
    expect(subdir.children[0].name).toBe('gamma')
    expect(subdir.children[0].path).toBe('subdir/gamma.md')
    expect(subdir.children[0].filename).toBe('subdir/gamma.md')
  })

  test('GET /api/files does not include non-.md files', async () => {
    const res = await client.api.files.$get()
    const tree = await res.json() as any[]
    const allPaths = tree
      .flatMap((n: any) => n.type === 'file' ? [n.path] : (n.children ?? []).map((c: any) => c.path))
    expect(allPaths.every((p: string) => p.endsWith('.md'))).toBe(true)
  })

  test('GET /api/files/:name returns root file content', async () => {
    const res = await client.api.files[':filename'].$get({ param: { filename: 'alpha.md' } })
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('# Alpha')
  })

  test('GET /api/files/:name returns ETag header', async () => {
    const res = await client.api.files[':filename'].$get({ param: { filename: 'alpha.md' } })
    expect(res.headers.get('ETag')).toMatch(/^"[\d.]+"$/)
  })

  test('GET /api/files/subdir/gamma.md returns nested file content', async () => {
    // testClient doesn't handle slashes in params — use app.request() directly
    const appRes = await app.request('/api/files/subdir/gamma.md')
    expect(appRes.status).toBe(200)
    const text = await appRes.text()
    expect(text).toContain('# Gamma')
  })

  test('GET /api/files/nonexistent returns 404', async () => {
    const res = await client.api.files[':filename'].$get({ param: { filename: 'nonexistent.md' } })
    expect(res.status).toBe(404)
  })

  test('GET /api/files/../etc/passwd is rejected', async () => {
    const res = await client.api.files[':filename'].$get({ param: { filename: '../etc/passwd' } })
    expect(res.status).not.toBe(200)
  })
})
```

- [ ] **Step 2: Run tests**

```bash
cd /home/perun/Code/notatnik.md && bun test apps/api/src/routes/files.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/files.test.ts
git commit -m "test: update files tests for tree structure and nested paths"
```

---

### Task 5: Update frontend store

**Files:**
- Modify: `apps/frontend/src/stores/vault.ts`

- [ ] **Step 1: Rewrite `apps/frontend/src/stores/vault.ts`**

```ts
// apps/frontend/src/stores/vault.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TreeNode } from '@notatnik/shared'

export const useVaultStore = defineStore('vault', () => {
  const vaultPath = ref('')
  const tree = ref<TreeNode[]>([])
  const changedFiles = ref(new Set<string>())  // relative paths with unseen changes

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
    tree.value = await res.json()
  }

  function firstFile(nodes: TreeNode[] = tree.value): TreeNode | null {
    for (const node of nodes) {
      if (node.type === 'file') return node
      if (node.children) {
        const found = firstFile(node.children)
        if (found) return found
      }
    }
    return null
  }

  function markChanged(filename: string) {
    changedFiles.value.add(filename)
  }

  function clearChanged(filename: string) {
    changedFiles.value.delete(filename)
  }

  return {
    vaultPath,
    tree,
    changedFiles,
    getHistory,
    setVault,
    loadVault,
    refreshFiles,
    firstFile,
    markChanged,
    clearChanged,
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/stores/vault.ts
git commit -m "store: files[] -> tree TreeNode[], add firstFile() helper"
```

---

### Task 6: Update router

**Files:**
- Modify: `apps/frontend/src/router/index.ts`

- [ ] **Step 1: Update `apps/frontend/src/router/index.ts`**

```ts
// apps/frontend/src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import FileView from '../views/FileView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/:path(.*)', component: FileView },
  ],
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/router/index.ts
git commit -m "router: wildcard route supports nested file paths"
```

---

### Task 7: Update FileView — use `route.params.path`

**Files:**
- Modify: `apps/frontend/src/views/FileView.vue`

- [ ] **Step 1: Update the `currentFilename` computed and related code in `FileView.vue`**

Replace the block at lines 44–48:

```ts
const currentFilename = computed(() => {
  const p = route.params.filename
  const name = Array.isArray(p) ? p[0] : p ?? ''
  return name.endsWith('.md') ? name : `${name}.md`
})
```

With:

```ts
const currentFilename = computed(() => {
  const p = route.params.path
  const name = Array.isArray(p) ? p[0] : p ?? ''
  return name.endsWith('.md') ? name : `${name}.md`
})
```

(Only `route.params.filename` → `route.params.path` changes — everything else stays identical.)

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/views/FileView.vue
git commit -m "fileview: use route.params.path for nested file paths"
```

---

### Task 8: Update App.vue — first file from tree

**Files:**
- Modify: `apps/frontend/src/App.vue`

- [ ] **Step 1: Update the `changeVault` function in `App.vue`**

Replace:

```ts
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
```

With:

```ts
async function changeVault() {
  const path = pathInput.value.trim()
  if (!path || path === vaultStore.vaultPath) return
  try {
    await vaultStore.setVault(path)
    const first = vaultStore.firstFile()
    if (first) router.push(`/${first.path}`)
  } catch (e: any) {
    alert(e.message ?? 'Błąd zmiany vaultu')
    pathInput.value = vaultStore.vaultPath
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/App.vue
git commit -m "app: navigate to first file in tree after vault change"
```

---

### Task 9: Create `TreeItem.vue` — recursive tree node component

**Files:**
- Create: `apps/frontend/src/components/TreeItem.vue`

- [ ] **Step 1: Create `apps/frontend/src/components/TreeItem.vue`**

```vue
<!-- apps/frontend/src/components/TreeItem.vue -->
<template>
  <li class="tree-node">
    <!-- Directory -->
    <div v-if="node.type === 'dir'" class="dir-item" @click="toggle">
      <span class="dir-arrow">{{ open ? '▾' : '▸' }}</span>
      <span class="dir-name">{{ node.name }}</span>
    </div>
    <ul v-if="node.type === 'dir' && open" class="subtree">
      <TreeItem
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :current-path="currentPath"
        :changed-files="changedFiles"
        @open="$emit('open', $event)"
      />
    </ul>

    <!-- File -->
    <div
      v-else-if="node.type === 'file'"
      class="file-item"
      :class="{ active: currentPath === node.path }"
      @click="$emit('open', node)"
    >
      <span class="file-name">{{ node.name }}</span>
      <span
        v-if="changedFiles.has(node.path) && currentPath !== node.path"
        class="change-dot"
        title="Plik zmieniony"
      />
    </div>
  </li>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { TreeNode } from '@notatnik/shared'

defineOptions({ name: 'TreeItem' })

const props = defineProps<{
  node: TreeNode
  currentPath: string
  changedFiles: Set<string>
}>()

defineEmits<{
  open: [node: TreeNode]
}>()

const STORAGE_KEY = `notatnik-tree-open:${props.node.path}`
const open = ref(
  props.node.type === 'dir'
    ? (localStorage.getItem(STORAGE_KEY) ?? 'open') !== 'closed'
    : false
)

function toggle() {
  open.value = !open.value
  localStorage.setItem(STORAGE_KEY, open.value ? 'open' : 'closed')
}
</script>

<style scoped>
.tree-node { list-style: none; }

.subtree { list-style: none; padding: 0; margin: 0; padding-left: 14px; }

.dir-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 16px;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 0.85rem;
  font-weight: 600;
  transition: background var(--transition);
}

.dir-item:hover { background: var(--bg-hover); }

.dir-arrow {
  font-size: 0.75rem;
  width: 12px;
  flex-shrink: 0;
  color: var(--text-secondary);
}

.dir-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 16px;
  cursor: pointer;
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
git add apps/frontend/src/components/TreeItem.vue
git commit -m "feat: add TreeItem.vue recursive tree node component"
```

---

### Task 10: Rewrite `Sidebar.vue` — use tree

**Files:**
- Modify: `apps/frontend/src/components/Sidebar.vue`

- [ ] **Step 1: Rewrite `apps/frontend/src/components/Sidebar.vue`**

```vue
<!-- apps/frontend/src/components/Sidebar.vue -->
<template>
  <nav class="sidebar">
    <ul class="tree-root">
      <li v-if="!vaultStore.tree.length" class="no-files">
        Brak plików .md w vaultcie
      </li>
      <TreeItem
        v-for="node in vaultStore.tree"
        :key="node.path"
        :node="node"
        :current-path="currentPath"
        :changed-files="vaultStore.changedFiles"
        @open="openFile"
      />
    </ul>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useVaultStore } from '../stores/vault'
import TreeItem from './TreeItem.vue'
import type { TreeNode } from '@notatnik/shared'

const vaultStore = useVaultStore()
const router = useRouter()
const route = useRoute()

const currentPath = computed(() => {
  const p = route.params.path
  const name = Array.isArray(p) ? p[0] : p ?? ''
  return name.endsWith('.md') ? name : `${name}.md`
})

function openFile(node: TreeNode) {
  vaultStore.clearChanged(node.path)
  router.push(`/${node.path}`)
}
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-w);
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  overflow-y: auto;
  overflow-x: hidden;
  flex-shrink: 0;
  transition: width 0.2s ease;
}

.sidebar.sidebar-collapsed {
  width: 0;
  border-right: none;
}

.tree-root { list-style: none; padding: 8px 0; margin: 0; }

.no-files {
  padding: 12px 16px;
  color: var(--text-secondary);
  font-size: 0.85rem;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/components/Sidebar.vue
git commit -m "feat: sidebar renders directory tree using TreeItem"
```

---

### Task 11: Run all tests and manual smoke test

- [ ] **Step 1: Run all tests**

```bash
cd /home/perun/Code/notatnik.md && bun test
```

Expected: all tests pass (no failures).

- [ ] **Step 2: Manual smoke test**

Start the dev server:
```bash
cd /home/perun/Code/notatnik.md && bun run --filter='*' dev
```

1. Open `http://localhost:5173`
2. Set vault path to a directory that has subdirectories with `.md` files (e.g. `/home/perun/Code/docs` or `/home/perun/Code/notatnik.md/docs`)
3. Verify sidebar shows directory tree with `▸/▾` toggles on directories
4. Click a directory → it expands/collapses
5. Click a `.md` file → content loads in main area
6. Verify URL shows nested path (e.g. `/superpowers/specs/2026-03-30-directory-tree-design.md`)
7. Verify active file is highlighted in sidebar
8. Reload page → same file reloads, directory state persists
