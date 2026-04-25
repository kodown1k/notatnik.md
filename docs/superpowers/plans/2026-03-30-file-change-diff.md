# File Change Diff Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an externally-modified file is open in the viewer, show a git-style diff panel (added/removed lines highlighted green/red) with Accept/Dismiss buttons instead of silently reloading.

**Architecture:** A standalone `diff.ts` utility computes a line-level LCS diff. `FileView.vue` gains `rawText`/`pendingText`/`diffLines` refs. The SSE callback for the current file now calls `fetchAndDiff()` instead of `loadFile(true)`. The diff panel is rendered above the document content.

**Tech Stack:** Vue 3, TypeScript, Vitest (frontend tests), Bun workspaces monorepo

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/frontend/src/diff.ts` | Create | LCS line-diff algorithm, `DiffLine` type |
| `apps/frontend/src/diff.test.ts` | Create | Vitest unit tests for `computeDiff` |
| `apps/frontend/src/views/FileView.vue` | Modify | `rawText`, `pendingText`, `diffLines`, `fetchAndDiff()`, diff panel UI |

---

### Task 1: LCS diff algorithm (TDD)

**Files:**
- Create: `apps/frontend/src/diff.test.ts`
- Create: `apps/frontend/src/diff.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/frontend/src/diff.test.ts`:

```ts
// apps/frontend/src/diff.test.ts
import { describe, test, expect } from 'vitest'
import { computeDiff } from './diff'

describe('computeDiff', () => {
  test('identical texts return empty array', () => {
    expect(computeDiff('hello\nworld', 'hello\nworld')).toEqual([])
  })

  test('empty old text — all lines are adds', () => {
    const result = computeDiff('', 'line1\nline2')
    expect(result.filter(l => l.type === 'add')).toHaveLength(2)
    expect(result.filter(l => l.type === 'remove')).toHaveLength(0)
  })

  test('empty new text — all lines are removes', () => {
    const result = computeDiff('line1\nline2', '')
    expect(result.filter(l => l.type === 'remove')).toHaveLength(2)
    expect(result.filter(l => l.type === 'add')).toHaveLength(0)
  })

  test('added line shows as add', () => {
    const result = computeDiff('line1\nline2', 'line1\nnew line\nline2')
    expect(result.some(l => l.type === 'add' && 'text' in l && l.text === 'new line')).toBe(true)
    expect(result.some(l => l.type === 'remove')).toBe(false)
  })

  test('removed line shows as remove', () => {
    const result = computeDiff('line1\nremoved\nline2', 'line1\nline2')
    expect(result.some(l => l.type === 'remove' && 'text' in l && l.text === 'removed')).toBe(true)
    expect(result.some(l => l.type === 'add')).toBe(false)
  })

  test('changed line shows as remove then add', () => {
    const result = computeDiff('line1\nold\nline2', 'line1\nnew\nline2')
    expect(result.some(l => l.type === 'remove' && 'text' in l && l.text === 'old')).toBe(true)
    expect(result.some(l => l.type === 'add' && 'text' in l && l.text === 'new')).toBe(true)
  })

  test('context lines appear around changes', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line${i}`)
    const modified = [...lines]
    modified[5] = 'changed'
    const result = computeDiff(lines.join('\n'), modified.join('\n'))
    expect(result.filter(l => l.type === 'context').length).toBeGreaterThan(0)
  })

  test('separator appears between distant hunks', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line${i}`)
    const modified = [...lines]
    modified[0] = 'changed0'
    modified[19] = 'changed19'
    const result = computeDiff(lines.join('\n'), modified.join('\n'))
    expect(result.some(l => l.type === 'sep')).toBe(true)
  })

  test('nearby changes share context, no separator between them', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line${i}`)
    const modified = [...lines]
    modified[4] = 'changedA'
    modified[5] = 'changedB'
    const result = computeDiff(lines.join('\n'), modified.join('\n'))
    expect(result.some(l => l.type === 'sep')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/perun/Code/notatnik.md/apps/frontend && bunx vitest run src/diff.test.ts
```

Expected: FAIL — `diff.ts` does not exist yet.

- [ ] **Step 3: Create `apps/frontend/src/diff.ts`**

```ts
// apps/frontend/src/diff.ts

export type DiffLine =
  | { type: 'add'; text: string }
  | { type: 'remove'; text: string }
  | { type: 'context'; text: string }
  | { type: 'sep' }

export function computeDiff(oldText: string, newText: string, context = 3): DiffLine[] {
  const oldLines = oldText === '' ? [] : oldText.split('\n')
  const newLines = newText === '' ? [] : newText.split('\n')

  const m = oldLines.length
  const n = newLines.length

  // Build LCS dp table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  // Backtrack to produce edit list
  type Edit = { type: 'add' | 'remove' | 'equal'; text: string }
  const edits: Edit[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      edits.unshift({ type: 'equal', text: oldLines[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      edits.unshift({ type: 'add', text: newLines[j - 1] })
      j--
    } else {
      edits.unshift({ type: 'remove', text: oldLines[i - 1] })
      i--
    }
  }

  // No changes?
  if (edits.every(e => e.type === 'equal')) return []

  // Determine which edit indices to include (changed ± context lines)
  const include = new Set<number>()
  for (let idx = 0; idx < edits.length; idx++) {
    if (edits[idx].type !== 'equal') {
      for (let c = Math.max(0, idx - context); c <= Math.min(edits.length - 1, idx + context); c++) {
        include.add(c)
      }
    }
  }

  // Build output, inserting separators for skipped ranges
  const result: DiffLine[] = []
  let lastIncluded = -1

  for (let idx = 0; idx < edits.length; idx++) {
    if (!include.has(idx)) continue
    if (lastIncluded !== -1 && idx > lastIncluded + 1) {
      result.push({ type: 'sep' })
    }
    const e = edits[idx]
    if (e.type === 'equal') {
      result.push({ type: 'context', text: e.text })
    } else {
      result.push({ type: e.type, text: e.text })
    }
    lastIncluded = idx
  }

  return result
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/perun/Code/notatnik.md && bun run --filter='@notatnik/frontend' test -- --run diff.test.ts
```

Expected: all 9 tests PASS.

(If vitest can't find the file, try: `cd /home/perun/Code/notatnik.md/apps/frontend && bunx vitest run`)

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/diff.ts apps/frontend/src/diff.test.ts
git commit -m "feat: LCS line-diff algorithm with context and separators"
```

---

### Task 2: Update FileView — fetchAndDiff logic

**Files:**
- Modify: `apps/frontend/src/views/FileView.vue`

The current file (after previous changes) has this structure in `<script setup>`:
- imports, route/store refs
- `doc`, `loading`, `error`, `lastEtag` refs
- `currentFilename` computed
- `PROGRESS_KEY` computed
- `loadProgress()`, `saveProgress()`, `handleToggle()`
- `loadFile(silent?)` — fetches and parses
- `onMounted`, `onUnmounted`, `watch(currentFilename, ...)`
- progress recomputation helpers

- [ ] **Step 1: Add new imports, refs, and helper functions to `FileView.vue`**

In the `<script setup>` block, add the import for `computeDiff` and `DiffLine` after the existing imports:

```ts
import { computeDiff, type DiffLine } from '../diff'
```

After the line `let lastEtag = ''`, add the three new refs:

```ts
const rawText = ref('')
const pendingText = ref<string | null>(null)
const diffLines = ref<DiffLine[]>([])
```

- [ ] **Step 2: Update `loadFile` to set `rawText`**

Find the current `loadFile` function. Inside the `try` block, after `doc.value = parse(text, currentFilename.value)`, add:

```ts
rawText.value = text
```

The updated try block inside `loadFile` should be:

```ts
  try {
    const res = await fetch(`/api/files/${currentFilename.value}`, {
      headers: lastEtag ? { 'If-None-Match': lastEtag } : {},
    })

    if (res.status === 304) return
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
```

- [ ] **Step 3: Add `fetchAndDiff`, `acceptDiff`, `dismissDiff` functions**

Add these three functions after `loadFile`:

```ts
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
```

- [ ] **Step 4: Replace `loadFile(true)` SSE callbacks with `fetchAndDiff`**

Find the two places where `() => loadFile(true)` is passed:

1. In `onMounted`:
```ts
sseStore.setCurrentFile(currentFilename.value, () => loadFile(true))
```
Change to:
```ts
sseStore.setCurrentFile(currentFilename.value, fetchAndDiff)
```

2. In `watch(currentFilename, ...)`:
```ts
sseStore.setCurrentFile(currentFilename.value, () => loadFile(true))
```
Change to:
```ts
sseStore.setCurrentFile(currentFilename.value, fetchAndDiff)
```

Also in `watch(currentFilename, ...)`, clear any pending diff when navigating away:

After `doc.value = null`, add:
```ts
pendingText.value = null
diffLines.value = []
```

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/views/FileView.vue
git commit -m "feat: fetchAndDiff replaces silent reload, stores pending diff"
```

---

### Task 3: Add diff panel to FileView template

**Files:**
- Modify: `apps/frontend/src/views/FileView.vue`

- [ ] **Step 1: Add diff panel to template**

In the `<template>` section, after the `<div class="doc-progress">` block (and before `<div v-if="loading">`), add the diff panel:

```html
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
```

- [ ] **Step 2: Add diff panel styles**

In the `<style scoped>` section, add after the existing styles:

```css
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
```

- [ ] **Step 3: Run all tests to make sure nothing broke**

```bash
cd /home/perun/Code/notatnik.md && bun test && cd apps/frontend && bunx vitest run
```

Expected: all backend tests pass (32), all frontend vitest tests pass (parser + diff).

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/views/FileView.vue
git commit -m "feat: diff panel UI in FileView — git-style add/remove highlighting"
```

---

### Task 4: Manual smoke test

- [ ] **Step 1: Start dev server**

```bash
cd /home/perun/Code/notatnik.md && bun run --filter='*' dev
```

- [ ] **Step 2: Open a .md file in the browser**

Navigate to `http://localhost:5173`, set vault path, open any `.md` file.

- [ ] **Step 3: Edit the file externally**

In a separate terminal:

```bash
echo "\n## New section" >> /path/to/your/vault/file.md
```

- [ ] **Step 4: Verify diff panel appears**

Within ~1s the diff panel should appear above the content showing:
- Green lines prefixed with `+` for the added content
- Context lines in muted color
- "Zaakceptuj zmiany" and "Zamknij" buttons

- [ ] **Step 5: Test Accept**

Click "Zaakceptuj zmiany" — panel disappears, content updates to show new section.

- [ ] **Step 6: Test Dismiss**

Edit the file again, wait for diff panel, click "Zamknij" — panel disappears, content stays unchanged.

- [ ] **Step 7: Test sidebar dot**

Edit a file that is NOT currently open. Verify the change-dot (amber circle) appears next to that file in the sidebar. Open the file — dot disappears.
