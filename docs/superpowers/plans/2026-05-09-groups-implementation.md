# Grupy plików — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wirtualne grupy plików z paletą kolorów — sidebar pokazuje sekcję Grupy nad drzewem; pliki/katalogi można dodawać przez drag&drop, menu kontekstowe (PPM) lub dialog. Grupy są persystowane w SQLite.

**Architecture:** Backend: Bun + Hono z `bun:sqlite` (zero nowych deps). Frontend: Vue 3 + Pinia store, natywny HTML5 DnD (zero nowych deps), `Teleport` do `body` dla ContextMenu. Plus motyw "Deep Night" jako wybieralny theme.

**Tech Stack:** Bun, Hono, bun:sqlite, Vue 3, Pinia, TypeScript, Vitest, bun:test.

**Spec:** `docs/superpowers/specs/2026-05-09-groups-design.md`

---

## File Structure

### Backend (apps/api/src/)

| Plik | Status | Odpowiedzialność |
|---|---|---|
| `db/groups.ts` | NEW | Otwarcie SQLite, schema init (`CREATE TABLE IF NOT EXISTS`), WAL mode, eksport instancji |
| `routes/groups.ts` | NEW | Hono router: `GET/POST /api/groups`, `PATCH/DELETE /api/groups/:id`, `POST /api/groups/:id/items`, `DELETE /api/groups/:id/items/:itemId`, `DELETE /api/groups/items/by-path` |
| `routes/groups.test.ts` | NEW | Testy bun:test dla wszystkich endpointów |
| `index.ts` | MODIFY | Zarejestrować `groupsRoutes` |

### Shared (packages/shared/)

| Plik | Status | Odpowiedzialność |
|---|---|---|
| `types.ts` | MODIFY | Dodać typy `Group`, `GroupItem`, `GroupColor` |

### Frontend (apps/frontend/src/)

| Plik | Status | Odpowiedzialność |
|---|---|---|
| `stores/groups.ts` | NEW | Pinia store: state (`groups`, `recentGroupIds`, `draggingPath`), actions, computed `groupsByPath` |
| `stores/groups.test.ts` | NEW | Testy Vitest dla store |
| `components/GroupsSection.vue` | NEW | Sekcja Grupy w sidebarze: nagłówek `+`, lista grup, drop-zone, inline form |
| `components/GroupRow.vue` | NEW | Pojedyncza grupa: zwijanie, lista elementów, kolor, drop-zone |
| `components/GroupItem.vue` | NEW | Pojedynczy element grupy z ikoną, ścieżką, `×`, ostrzeżeniem dla niedostępnych |
| `components/GroupDialog.vue` | NEW | Modal wyboru grupy (toggle membership) |
| `components/ContextMenu.vue` | NEW | PPM menu z `Teleport to="body"`, lista ostatnich grup + link do dialogu |
| `components/Sidebar.vue` | MODIFY | Wstawić `<GroupsSection>` nad drzewem |
| `components/TreeItem.vue` | MODIFY | `draggable="true"`, `@dragstart`, `@contextmenu`, kwadracik wskaźnika koloru |
| `components/SettingsPanel.vue` | MODIFY | Dodać sekcję wyboru motywu (Dark / Light / Deep Night) |
| `stores/settings.ts` | MODIFY | Dodać typ `Theme = 'dark' | 'light' | 'deep-night'` i obsługę |
| `components/ThemeToggle.vue` | MODIFY | Uprościć: czytać/pisać przez `useSettingsStore().theme` zamiast osobnego klucza localStorage |
| `style.css` | MODIFY | Nowy blok `[data-theme="deep-night"]` z paletą |

---

## Task 0: Szkielet — sanity check

Cel: upewnić się że projekt buduje się i testy przechodzą zanim coś zmienimy.

**Files:** brak zmian

- [ ] **Step 1: Uruchom istniejące testy backendu**

```bash
cd /home/perun/Code/notatnik.md
bun --cwd apps/api test
```

Expected: wszystkie testy passują.

- [ ] **Step 2: Uruchom testy frontendu**

```bash
bun --cwd apps/frontend test
```

Expected: wszystkie testy passują.

- [ ] **Step 3: Build frontendu (TypeCheck)**

```bash
bun --cwd apps/frontend run build
```

Expected: build success, brak błędów TS.

---

## Task 1: Shared types

**Files:**
- Modify: `packages/shared/types.ts`

- [ ] **Step 1: Dodaj typy grup na końcu pliku**

```typescript
// Groups feature

export const GROUP_COLORS = [
  '#c084fc', // Fiolet
  '#34d399', // Zieleń
  '#fb923c', // Pomarańcz
  '#60a5fa', // Błękit
  '#f472b6', // Róż
  '#f87171', // Czerwień
  '#fbbf24', // Żółć
  '#818cf8', // Indygo
] as const

export type GroupColor = typeof GROUP_COLORS[number]

export interface GroupItem {
  id: number
  path: string       // relative to vault root
  added_at: number   // unix timestamp
}

export interface Group {
  id: number
  name: string
  color: string      // hex like "#c084fc" — not narrowed to GroupColor (DB allows custom)
  items: GroupItem[]
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/types.ts
git commit -m "feat(shared): add Group, GroupItem, GROUP_COLORS types"
```

---

## Task 2: SQLite — schema i połączenie

**Files:**
- Create: `apps/api/src/db/groups.ts`

- [ ] **Step 1: Utwórz `apps/api/src/db/groups.ts`**

```typescript
// apps/api/src/db/groups.ts
import { Database } from 'bun:sqlite'
import { join } from 'path'

const DB_PATH = process.env.GROUPS_DB_PATH ?? join(import.meta.dir, '../../../../groups.db')

export const groupsDb = new Database(DB_PATH, { create: true })

groupsDb.exec('PRAGMA journal_mode=WAL')
groupsDb.exec('PRAGMA foreign_keys=ON')

groupsDb.exec(`
  CREATE TABLE IF NOT EXISTS groups (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL,
    color TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS group_items (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    path      TEXT NOT NULL,
    added_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(group_id, path)
  );

  CREATE INDEX IF NOT EXISTS idx_group_items_path ON group_items(path);
`)
```

`GROUPS_DB_PATH` env var pozwala testom użyć tymczasowego pliku (`:memory:` nie wystarczy bo używamy WAL).

- [ ] **Step 2: Sprawdź że plik DB powstaje przy imporcie**

```bash
cd /home/perun/Code/notatnik.md
bun --cwd apps/api -e "import('./src/db/groups').then(() => console.log('OK'))"
ls -la groups.db
```

Expected: plik `groups.db` istnieje, wypisuje "OK".

- [ ] **Step 3: Dodaj `groups.db*` do `.gitignore`**

Otwórz `.gitignore`, dodaj na końcu:

```
# SQLite
groups.db
groups.db-journal
groups.db-wal
groups.db-shm
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/db/groups.ts .gitignore
git commit -m "feat(api): add SQLite groups database with WAL mode"
```

---

## Task 3: API — `GET /api/groups`

**Files:**
- Create: `apps/api/src/routes/groups.ts`
- Create: `apps/api/src/routes/groups.test.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Napisz failing test**

Utwórz `apps/api/src/routes/groups.test.ts`:

```typescript
// apps/api/src/routes/groups.test.ts
import { describe, test, expect, beforeEach } from 'bun:test'
import { testClient } from 'hono/testing'
import { Hono } from 'hono'
import { tmpdir } from 'os'
import { join } from 'path'
import { unlinkSync, existsSync } from 'fs'

// Use fresh DB file per test process
const TEST_DB = join(tmpdir(), `groups-test-${process.pid}.db`)
process.env.GROUPS_DB_PATH = TEST_DB

const { groupsRoutes } = await import('./groups')
const { groupsDb } = await import('../db/groups')

const app = new Hono()
app.route('/api/groups', groupsRoutes)
const client = testClient(app)

function reset() {
  groupsDb.exec('DELETE FROM group_items; DELETE FROM groups;')
}

describe('groups routes — GET', () => {
  beforeEach(reset)

  test('GET /api/groups returns empty array initially', async () => {
    const res = await client.api.groups.$get()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })
})
```

- [ ] **Step 2: Utwórz minimalny `routes/groups.ts`**

```typescript
// apps/api/src/routes/groups.ts
import { Hono } from 'hono'
import { groupsDb } from '../db/groups'
import type { Group } from '@notatnik/shared'

export const groupsRoutes = new Hono()

groupsRoutes.get('/', (c) => {
  const groups = groupsDb.query('SELECT id, name, color FROM groups ORDER BY id ASC').all() as Array<Omit<Group, 'items'>>
  const items = groupsDb.query('SELECT id, group_id, path, added_at FROM group_items ORDER BY added_at ASC').all() as Array<{ id: number; group_id: number; path: string; added_at: number }>
  const byGroup = new Map<number, Group['items']>()
  for (const it of items) {
    if (!byGroup.has(it.group_id)) byGroup.set(it.group_id, [])
    byGroup.get(it.group_id)!.push({ id: it.id, path: it.path, added_at: it.added_at })
  }
  const result: Group[] = groups.map((g) => ({ ...g, items: byGroup.get(g.id) ?? [] }))
  return c.json(result)
})
```

- [ ] **Step 3: Uruchom testy**

```bash
cd /home/perun/Code/notatnik.md
bun --cwd apps/api test src/routes/groups.test.ts
```

Expected: PASS.

- [ ] **Step 4: Zarejestruj route w `index.ts`**

W `apps/api/src/index.ts` dodaj import i mount:

```typescript
import { groupsRoutes } from './routes/groups'
// ...
app.route('/api/groups', groupsRoutes)
```

(Wstaw obok pozostałych `app.route(...)` — po `app.route('/api/sse', sseRoutes)`.)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/groups.ts apps/api/src/routes/groups.test.ts apps/api/src/index.ts
git commit -m "feat(api): GET /api/groups returns groups with items"
```

---

## Task 4: API — `POST /api/groups`

**Files:**
- Modify: `apps/api/src/routes/groups.ts`
- Modify: `apps/api/src/routes/groups.test.ts`

- [ ] **Step 1: Dodaj failing test**

W `groups.test.ts` dodaj nowy `describe`:

```typescript
describe('groups routes — POST', () => {
  beforeEach(reset)

  test('POST /api/groups creates new group', async () => {
    const res = await client.api.groups.$post({ json: { name: 'Projekt Alpha', color: '#c084fc' } })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBeGreaterThan(0)
    expect(body.name).toBe('Projekt Alpha')
    expect(body.color).toBe('#c084fc')
    expect(body.items).toEqual([])
  })

  test('POST /api/groups with empty name returns 400', async () => {
    const res = await client.api.groups.$post({ json: { name: '', color: '#c084fc' } })
    expect(res.status).toBe(400)
  })

  test('POST /api/groups with missing color returns 400', async () => {
    const res = await client.api.groups.$post({ json: { name: 'X' } as any })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Implementacja w `routes/groups.ts`**

Dodaj poniżej `groupsRoutes.get('/', ...)`:

```typescript
groupsRoutes.post('/', async (c) => {
  const body = await c.req.json<{ name?: string; color?: string }>().catch(() => ({}))
  const name = body.name?.trim()
  const color = body.color?.trim()
  if (!name) return c.json({ error: 'name is required' }, 400)
  if (!color) return c.json({ error: 'color is required' }, 400)

  const result = groupsDb.query('INSERT INTO groups (name, color) VALUES (?, ?) RETURNING id').get(name, color) as { id: number }
  return c.json({ id: result.id, name, color, items: [] }, 201)
})
```

- [ ] **Step 3: Uruchom testy**

```bash
bun --cwd apps/api test src/routes/groups.test.ts
```

Expected: wszystkie passują.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/groups.ts apps/api/src/routes/groups.test.ts
git commit -m "feat(api): POST /api/groups creates group"
```

---

## Task 5: API — `PATCH` i `DELETE /api/groups/:id`

**Files:**
- Modify: `apps/api/src/routes/groups.ts`
- Modify: `apps/api/src/routes/groups.test.ts`

- [ ] **Step 1: Dodaj failing testy**

```typescript
describe('groups routes — PATCH/DELETE', () => {
  beforeEach(reset)

  test('PATCH /api/groups/:id renames group', async () => {
    const created = await (await client.api.groups.$post({ json: { name: 'Old', color: '#c084fc' } })).json()
    const res = await client.api.groups[':id'].$patch({ param: { id: String(created.id) }, json: { name: 'New' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('New')
    expect(body.color).toBe('#c084fc')
  })

  test('PATCH /api/groups/:id changes color', async () => {
    const created = await (await client.api.groups.$post({ json: { name: 'X', color: '#c084fc' } })).json()
    const res = await client.api.groups[':id'].$patch({ param: { id: String(created.id) }, json: { color: '#34d399' } })
    expect(res.status).toBe(200)
    expect((await res.json()).color).toBe('#34d399')
  })

  test('PATCH /api/groups/:id with non-existent id returns 404', async () => {
    const res = await client.api.groups[':id'].$patch({ param: { id: '99999' }, json: { name: 'X' } })
    expect(res.status).toBe(404)
  })

  test('DELETE /api/groups/:id removes group', async () => {
    const created = await (await client.api.groups.$post({ json: { name: 'X', color: '#c084fc' } })).json()
    const res = await client.api.groups[':id'].$delete({ param: { id: String(created.id) } })
    expect(res.status).toBe(204)
    const list = await (await client.api.groups.$get()).json()
    expect(list).toEqual([])
  })

  test('DELETE /api/groups/:id with non-existent id returns 404', async () => {
    const res = await client.api.groups[':id'].$delete({ param: { id: '99999' } })
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Implementacja**

Dodaj do `routes/groups.ts`:

```typescript
groupsRoutes.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400)

  const body = await c.req.json<{ name?: string; color?: string }>().catch(() => ({}))
  const existing = groupsDb.query('SELECT id, name, color FROM groups WHERE id = ?').get(id) as { id: number; name: string; color: string } | null
  if (!existing) return c.json({ error: 'not found' }, 404)

  const newName = body.name?.trim() || existing.name
  const newColor = body.color?.trim() || existing.color
  groupsDb.run('UPDATE groups SET name = ?, color = ? WHERE id = ?', [newName, newColor, id])

  return c.json({ id, name: newName, color: newColor })
})

groupsRoutes.delete('/:id', (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400)
  const res = groupsDb.run('DELETE FROM groups WHERE id = ?', [id])
  if (res.changes === 0) return c.json({ error: 'not found' }, 404)
  return c.body(null, 204)
})
```

- [ ] **Step 3: Uruchom testy**

```bash
bun --cwd apps/api test src/routes/groups.test.ts
```

Expected: wszystkie passują.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/groups.ts apps/api/src/routes/groups.test.ts
git commit -m "feat(api): PATCH and DELETE /api/groups/:id"
```

---

## Task 6: API — items (add / remove / by-path)

**Files:**
- Modify: `apps/api/src/routes/groups.ts`
- Modify: `apps/api/src/routes/groups.test.ts`

- [ ] **Step 1: Dodaj failing testy**

```typescript
describe('groups routes — items', () => {
  beforeEach(reset)

  async function makeGroup() {
    return await (await client.api.groups.$post({ json: { name: 'G', color: '#c084fc' } })).json()
  }

  test('POST /api/groups/:id/items adds path', async () => {
    const g = await makeGroup()
    const res = await client.api.groups[':id'].items.$post({ param: { id: String(g.id) }, json: { path: 'PRD.md' } })
    expect(res.status).toBe(201)
    const item = await res.json()
    expect(item.path).toBe('PRD.md')
    expect(item.id).toBeGreaterThan(0)
  })

  test('POST /api/groups/:id/items duplicate is idempotent (returns existing)', async () => {
    const g = await makeGroup()
    const r1 = await (await client.api.groups[':id'].items.$post({ param: { id: String(g.id) }, json: { path: 'PRD.md' } })).json()
    const r2 = await client.api.groups[':id'].items.$post({ param: { id: String(g.id) }, json: { path: 'PRD.md' } })
    expect(r2.status).toBe(200)
    const item = await r2.json()
    expect(item.id).toBe(r1.id)
  })

  test('POST /api/groups/:id/items with empty path returns 400', async () => {
    const g = await makeGroup()
    const res = await client.api.groups[':id'].items.$post({ param: { id: String(g.id) }, json: { path: '' } })
    expect(res.status).toBe(400)
  })

  test('POST to non-existent group returns 404', async () => {
    const res = await client.api.groups[':id'].items.$post({ param: { id: '99999' }, json: { path: 'PRD.md' } })
    expect(res.status).toBe(404)
  })

  test('DELETE /api/groups/:id/items/:itemId removes item', async () => {
    const g = await makeGroup()
    const item = await (await client.api.groups[':id'].items.$post({ param: { id: String(g.id) }, json: { path: 'PRD.md' } })).json()
    const res = await client.api.groups[':id'].items[':itemId'].$delete({ param: { id: String(g.id), itemId: String(item.id) } })
    expect(res.status).toBe(204)
  })

  test('DELETE /api/groups/items/by-path removes from all groups', async () => {
    const g1 = await makeGroup()
    const g2 = await makeGroup()
    await client.api.groups[':id'].items.$post({ param: { id: String(g1.id) }, json: { path: 'PRD.md' } })
    await client.api.groups[':id'].items.$post({ param: { id: String(g2.id) }, json: { path: 'PRD.md' } })

    const res = await client.api.groups.items['by-path'].$delete({ query: { path: 'PRD.md' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.removed).toBe(2)

    const list = await (await client.api.groups.$get()).json()
    expect(list[0].items).toEqual([])
    expect(list[1].items).toEqual([])
  })
})
```

- [ ] **Step 2: Implementacja**

Dodaj do `routes/groups.ts`:

```typescript
groupsRoutes.post('/:id/items', async (c) => {
  const groupId = Number(c.req.param('id'))
  if (!Number.isFinite(groupId)) return c.json({ error: 'invalid id' }, 400)

  const body = await c.req.json<{ path?: string }>().catch(() => ({}))
  const path = body.path?.trim()
  if (!path) return c.json({ error: 'path is required' }, 400)

  const group = groupsDb.query('SELECT id FROM groups WHERE id = ?').get(groupId)
  if (!group) return c.json({ error: 'group not found' }, 404)

  const existing = groupsDb.query('SELECT id, group_id, path, added_at FROM group_items WHERE group_id = ? AND path = ?').get(groupId, path) as { id: number; group_id: number; path: string; added_at: number } | null
  if (existing) {
    return c.json({ id: existing.id, path: existing.path, added_at: existing.added_at }, 200)
  }

  const inserted = groupsDb.query('INSERT INTO group_items (group_id, path) VALUES (?, ?) RETURNING id, added_at').get(groupId, path) as { id: number; added_at: number }
  return c.json({ id: inserted.id, path, added_at: inserted.added_at }, 201)
})

groupsRoutes.delete('/:id/items/:itemId', (c) => {
  const groupId = Number(c.req.param('id'))
  const itemId = Number(c.req.param('itemId'))
  if (!Number.isFinite(groupId) || !Number.isFinite(itemId)) return c.json({ error: 'invalid id' }, 400)
  const res = groupsDb.run('DELETE FROM group_items WHERE id = ? AND group_id = ?', [itemId, groupId])
  if (res.changes === 0) return c.json({ error: 'not found' }, 404)
  return c.body(null, 204)
})

groupsRoutes.delete('/items/by-path', (c) => {
  const path = c.req.query('path')?.trim()
  if (!path) return c.json({ error: 'path query param required' }, 400)
  const res = groupsDb.run('DELETE FROM group_items WHERE path = ?', [path])
  return c.json({ removed: res.changes })
})
```

**Uwaga o kolejności routes w Hono:** `delete('/items/by-path')` musi być zarejestrowane PRZED `delete('/:id')` żeby Hono nie potraktował `items` jako `:id`. Sprawdź że tak jest w finalnym pliku.

- [ ] **Step 3: Uruchom wszystkie testy backendu**

```bash
bun --cwd apps/api test
```

Expected: wszystkie passują.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/groups.ts apps/api/src/routes/groups.test.ts
git commit -m "feat(api): items endpoints (add, delete, delete by-path)"
```

---

## Task 7: Frontend — Pinia store dla grup

**Files:**
- Create: `apps/frontend/src/stores/groups.ts`
- Create: `apps/frontend/src/stores/groups.test.ts`

- [ ] **Step 1: Napisz failing test**

```typescript
// apps/frontend/src/stores/groups.test.ts
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGroupsStore } from './groups'
import type { Group } from '@notatnik/shared'

describe('groups store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  test('groupsByPath maps paths to groups', () => {
    const store = useGroupsStore()
    store.$patch({
      groups: [
        { id: 1, name: 'A', color: '#c084fc', items: [{ id: 1, path: 'PRD.md', added_at: 0 }] },
        { id: 2, name: 'B', color: '#34d399', items: [{ id: 2, path: 'PRD.md', added_at: 0 }] },
      ] as Group[],
    })
    expect(store.groupsByPath.get('PRD.md')?.length).toBe(2)
    expect(store.groupsByPath.get('PRD.md')?.[0].name).toBe('A')
  })

  test('recentGroupIds is persisted to localStorage', () => {
    const store = useGroupsStore()
    store.markRecent(5)
    store.markRecent(3)
    store.markRecent(5)  // re-mark — should move to front
    expect(store.recentGroupIds).toEqual([5, 3])
    const saved = JSON.parse(localStorage.getItem('notatnik-recent-groups') ?? '[]')
    expect(saved).toEqual([5, 3])
  })

  test('fetchGroups populates state', async () => {
    const fakeData: Group[] = [{ id: 1, name: 'X', color: '#c084fc', items: [] }]
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(fakeData) } as any))
    const store = useGroupsStore()
    await store.fetchGroups()
    expect(store.groups).toEqual(fakeData)
  })
})
```

- [ ] **Step 2: Sprawdź że test fail-uje**

```bash
bun --cwd apps/frontend test src/stores/groups.test.ts
```

Expected: FAIL — module nie istnieje.

- [ ] **Step 3: Utwórz store**

```typescript
// apps/frontend/src/stores/groups.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Group, GroupItem } from '@notatnik/shared'

const RECENT_KEY = 'notatnik-recent-groups'
const MAX_RECENT = 3

export const useGroupsStore = defineStore('groups', () => {
  const groups = ref<Group[]>([])
  const draggingPath = ref<string | null>(null)

  const initialRecent: number[] = (() => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') }
    catch { return [] }
  })()
  const recentGroupIds = ref<number[]>(initialRecent)

  const groupsByPath = computed(() => {
    const map = new Map<string, Group[]>()
    for (const g of groups.value) {
      for (const it of g.items) {
        if (!map.has(it.path)) map.set(it.path, [])
        map.get(it.path)!.push(g)
      }
    }
    return map
  })

  const recentGroups = computed(() =>
    recentGroupIds.value
      .map((id) => groups.value.find((g) => g.id === id))
      .filter((g): g is Group => !!g)
  )

  function markRecent(id: number) {
    const next = [id, ...recentGroupIds.value.filter((x) => x !== id)].slice(0, MAX_RECENT)
    recentGroupIds.value = next
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  }

  async function fetchGroups() {
    const res = await fetch('/api/groups')
    if (!res.ok) throw new Error('fetch groups failed')
    groups.value = await res.json()
  }

  async function createGroup(name: string, color: string): Promise<Group> {
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    })
    if (!res.ok) throw new Error('create group failed')
    const created: Group = await res.json()
    groups.value = [...groups.value, created]
    return created
  }

  async function updateGroup(id: number, patch: { name?: string; color?: string }) {
    const res = await fetch(`/api/groups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error('update group failed')
    const updated = await res.json()
    const idx = groups.value.findIndex((g) => g.id === id)
    if (idx >= 0) groups.value[idx] = { ...groups.value[idx], ...updated }
  }

  async function deleteGroup(id: number) {
    const res = await fetch(`/api/groups/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('delete group failed')
    groups.value = groups.value.filter((g) => g.id !== id)
    recentGroupIds.value = recentGroupIds.value.filter((x) => x !== id)
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentGroupIds.value))
  }

  async function addItem(groupId: number, path: string): Promise<GroupItem> {
    const res = await fetch(`/api/groups/${groupId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    })
    if (!res.ok) throw new Error('add item failed')
    const item: GroupItem = await res.json()
    const group = groups.value.find((g) => g.id === groupId)
    if (group && !group.items.some((i) => i.id === item.id)) {
      group.items = [...group.items, item]
    }
    markRecent(groupId)
    return item
  }

  async function removeItem(groupId: number, itemId: number) {
    const res = await fetch(`/api/groups/${groupId}/items/${itemId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('remove item failed')
    const group = groups.value.find((g) => g.id === groupId)
    if (group) group.items = group.items.filter((i) => i.id !== itemId)
  }

  async function removeFromAllGroups(path: string) {
    const url = `/api/groups/items/by-path?path=${encodeURIComponent(path)}`
    const res = await fetch(url, { method: 'DELETE' })
    if (!res.ok) throw new Error('remove all failed')
    for (const g of groups.value) {
      g.items = g.items.filter((i) => i.path !== path)
    }
  }

  return {
    groups,
    draggingPath,
    recentGroupIds,
    recentGroups,
    groupsByPath,
    fetchGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    addItem,
    removeItem,
    removeFromAllGroups,
    markRecent,
  }
})
```

- [ ] **Step 4: Uruchom testy**

```bash
bun --cwd apps/frontend test src/stores/groups.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/stores/groups.ts apps/frontend/src/stores/groups.test.ts
git commit -m "feat(frontend): add Pinia groups store"
```

---

## Task 8: Frontend — `GroupsSection` komponent (lista grup, bez DnD)

**Files:**
- Create: `apps/frontend/src/components/GroupsSection.vue`
- Create: `apps/frontend/src/components/GroupRow.vue`
- Create: `apps/frontend/src/components/GroupItem.vue`
- Modify: `apps/frontend/src/components/Sidebar.vue`
- Modify: `apps/frontend/src/App.vue` (init store)

- [ ] **Step 1: Utwórz `GroupItem.vue`**

```vue
<!-- apps/frontend/src/components/GroupItem.vue -->
<template>
  <div class="group-item" :class="{ stale }" @click="onClick">
    <span class="icon">{{ isDir ? '📁' : '📄' }}</span>
    <span v-if="stale" class="stale-icon" title="Plik niedostępny w aktualnym vaultcie">⚠️</span>
    <span class="path">{{ item.path }}</span>
    <button class="remove" @click.stop="$emit('remove')" title="Usuń z grupy">×</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { GroupItem as TGroupItem } from '@notatnik/shared'
import { useVaultStore } from '../stores/vault'

const props = defineProps<{ item: TGroupItem }>()
defineEmits<{ remove: [] }>()

const router = useRouter()
const vaultStore = useVaultStore()

const isDir = computed(() => !props.item.path.endsWith('.md'))

function existsInTree(path: string): boolean {
  function walk(nodes = vaultStore.tree): boolean {
    for (const n of nodes) {
      if (n.path === path) return true
      if (n.children && walk(n.children)) return true
    }
    return false
  }
  return walk()
}

const stale = computed(() => !existsInTree(props.item.path))

function onClick() {
  if (stale.value) return
  if (!isDir.value) router.push(`/${props.item.path}`)
}
</script>

<style scoped>
.group-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 6px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.78rem;
  color: var(--text-secondary);
  transition: background var(--transition);
}
.group-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.group-item.stale { opacity: 0.5; cursor: not-allowed; }
.icon { flex-shrink: 0; font-size: 0.7rem; }
.stale-icon { flex-shrink: 0; font-size: 0.7rem; }
.path { min-width: 0; word-break: break-word; flex: 1; }
.remove {
  background: none; border: none; color: var(--text-secondary); cursor: pointer;
  padding: 0 4px; font-size: 0.85rem; opacity: 0; transition: opacity var(--transition);
}
.group-item:hover .remove { opacity: 1; }
.remove:hover { color: var(--accent); }
</style>
```

- [ ] **Step 2: Utwórz `GroupRow.vue`**

```vue
<!-- apps/frontend/src/components/GroupRow.vue -->
<template>
  <div class="group-row" :class="{ 'drag-over': isDragOver }"
       @dragover.prevent="onDragOver"
       @dragleave="isDragOver = false"
       @drop.prevent="onDrop">
    <div class="group-header" @click="toggle">
      <span class="arrow">{{ open ? '▾' : '▸' }}</span>
      <span class="color-square" :style="{ background: group.color }" />
      <span class="name">{{ group.name }}</span>
      <button class="remove" @click.stop="confirmDelete" title="Usuń grupę">×</button>
    </div>
    <div v-if="open" class="items">
      <GroupItem
        v-for="item in group.items"
        :key="item.id"
        :item="item"
        @remove="removeItem(item.id)"
      />
      <div v-if="!group.items.length" class="empty">brak elementów</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Group } from '@notatnik/shared'
import { useGroupsStore } from '../stores/groups'
import GroupItem from './GroupItem.vue'

const props = defineProps<{ group: Group }>()
const groupsStore = useGroupsStore()

const STORAGE_KEY = `notatnik-group-open:${props.group.id}`
const open = ref(localStorage.getItem(STORAGE_KEY) !== 'closed')
const isDragOver = ref(false)

function toggle() {
  open.value = !open.value
  localStorage.setItem(STORAGE_KEY, open.value ? 'open' : 'closed')
}

async function confirmDelete() {
  if (!confirm(`Usunąć grupę "${props.group.name}"? (Pliki na dysku NIE zostaną usunięte.)`)) return
  await groupsStore.deleteGroup(props.group.id)
}

async function removeItem(itemId: number) {
  await groupsStore.removeItem(props.group.id, itemId)
}

function onDragOver() {
  if (groupsStore.draggingPath) isDragOver.value = true
}

async function onDrop() {
  isDragOver.value = false
  const path = groupsStore.draggingPath
  if (!path) return
  groupsStore.draggingPath = null
  await groupsStore.addItem(props.group.id, path)
  if (!open.value) toggle()
}
</script>

<style scoped>
.group-row { border-bottom: 1px solid var(--border); transition: background var(--transition); }
.group-row.drag-over { background: var(--bg-hover); box-shadow: inset 0 0 0 2px var(--accent); }

.group-header {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; cursor: pointer; font-size: 0.82rem;
  color: var(--text-primary); font-weight: 500;
}
.group-header:hover { background: var(--bg-hover); }

.arrow { font-size: 0.7rem; width: 10px; flex-shrink: 0; color: var(--text-secondary); }
.color-square { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
.name { flex: 1; min-width: 0; word-break: break-word; }
.remove {
  background: none; border: none; color: var(--text-secondary); cursor: pointer;
  padding: 0 4px; font-size: 0.95rem; opacity: 0; transition: opacity var(--transition);
}
.group-header:hover .remove { opacity: 1; }
.remove:hover { color: var(--accent); }

.items { padding: 0 8px 6px 24px; }
.empty { padding: 4px 6px; color: var(--text-secondary); font-size: 0.72rem; opacity: 0.6; font-style: italic; }
</style>
```

- [ ] **Step 3: Utwórz `GroupsSection.vue`**

```vue
<!-- apps/frontend/src/components/GroupsSection.vue -->
<template>
  <section class="groups-section">
    <header class="section-header">
      <span class="label">Grupy</span>
      <button class="add-btn" @click="startCreate" title="Nowa grupa">+</button>
    </header>

    <div v-if="creating" class="create-form">
      <div class="palette">
        <button v-for="c in colors" :key="c"
                class="swatch" :class="{ selected: selectedColor === c }"
                :style="{ background: c }"
                @click="selectedColor = c"
                :title="c" />
      </div>
      <input ref="nameInput"
             v-model="newName"
             class="name-input"
             placeholder="Nazwa grupy…"
             @keydown.enter="commitCreate"
             @keydown.escape="cancelCreate"
             @blur="commitCreate" />
    </div>

    <div class="groups-list">
      <GroupRow v-for="g in groupsStore.groups" :key="g.id" :group="g" />
      <div v-if="!groupsStore.groups.length && !creating" class="empty">
        Brak grup. Kliknij <strong>+</strong> żeby utworzyć pierwszą.
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { GROUP_COLORS } from '@notatnik/shared'
import { useGroupsStore } from '../stores/groups'
import GroupRow from './GroupRow.vue'

const groupsStore = useGroupsStore()
const colors = GROUP_COLORS
const creating = ref(false)
const newName = ref('')
const selectedColor = ref<string>(colors[0])
const nameInput = ref<HTMLInputElement | null>(null)
let suppressBlurCommit = false

async function startCreate() {
  creating.value = true
  newName.value = ''
  selectedColor.value = colors[0]
  await nextTick()
  nameInput.value?.focus()
}

async function commitCreate() {
  if (suppressBlurCommit) return
  const name = newName.value.trim()
  if (!name) {
    creating.value = false
    return
  }
  await groupsStore.createGroup(name, selectedColor.value)
  creating.value = false
}

function cancelCreate() {
  suppressBlurCommit = true
  creating.value = false
  setTimeout(() => { suppressBlurCommit = false }, 0)
}
</script>

<style scoped>
.groups-section { border-bottom: 1px solid var(--border); }

.section-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 12px; border-bottom: 1px solid var(--border);
}
.label { font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; }
.add-btn {
  background: none; border: none; color: var(--text-secondary); cursor: pointer;
  font-size: 1.1rem; line-height: 1; padding: 0 4px;
}
.add-btn:hover { color: var(--accent); }

.create-form { padding: 6px 10px; background: var(--bg-hover); border-bottom: 1px solid var(--border); }
.palette { display: flex; gap: 4px; margin-bottom: 5px; }
.swatch {
  width: 14px; height: 14px; border-radius: 3px; border: 1px solid transparent; cursor: pointer; padding: 0;
}
.swatch.selected { border-color: var(--text-primary); transform: scale(1.15); }
.name-input {
  width: 100%;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--accent);
  color: var(--text-primary);
  font-size: 0.78rem;
  outline: none;
  padding: 2px 0;
}

.groups-list { padding: 2px 0; }
.empty {
  padding: 8px 12px; color: var(--text-secondary); font-size: 0.72rem; opacity: 0.6; line-height: 1.5;
}
</style>
```

- [ ] **Step 4: Zmodyfikuj `Sidebar.vue` — dodaj sekcję grup**

Otwórz `apps/frontend/src/components/Sidebar.vue`. Zmień `<template>`:

```vue
<template>
  <nav class="sidebar">
    <GroupsSection />
    <div class="files-section">
      <div class="section-label">Pliki</div>
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
    </div>
  </nav>
</template>
```

Dodaj import w `<script setup>`:

```typescript
import GroupsSection from './GroupsSection.vue'
```

Dodaj style do `<style scoped>`:

```css
.section-label {
  padding: 8px 16px 4px;
  font-size: 0.72rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 1px solid var(--border);
}
.files-section { display: flex; flex-direction: column; }
```

- [ ] **Step 5: W `App.vue` zainicjuj fetch grup po loadVault**

W `<script setup>` `App.vue` znajdź `onMounted` i dodaj `fetchGroups()` po `loadVault`:

```typescript
import { useGroupsStore } from './stores/groups'
const groupsStore = useGroupsStore()

onMounted(async () => {
  await vaultStore.loadVault()
  await groupsStore.fetchGroups()
  pathInput.value = vaultStore.vaultPath
  sseStore.connect()
})
```

- [ ] **Step 6: Uruchom dev i sprawdź wizualnie**

```bash
cd /home/perun/Code/notatnik.md
# w jednym terminalu:
bun --cwd apps/api dev
# w drugim:
bun --cwd apps/frontend dev
```

Otwórz `http://localhost:5173`, ustaw vault. Sprawdź:
- Sekcja "GRUPY" widoczna nad drzewem
- Klik `+` otwiera form z paletą i inputem
- Wpisanie nazwy + Enter tworzy grupę
- Grupa pojawia się w liście, można ją zwijać/rozwijać
- Klik `×` na nagłówku grupy usuwa ją (po potwierdzeniu)

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/components/GroupsSection.vue \
        apps/frontend/src/components/GroupRow.vue \
        apps/frontend/src/components/GroupItem.vue \
        apps/frontend/src/components/Sidebar.vue \
        apps/frontend/src/App.vue
git commit -m "feat(frontend): groups section with create/list/delete"
```

---

## Task 9: Frontend — drag & drop z drzewa do grup

**Files:**
- Modify: `apps/frontend/src/components/TreeItem.vue`

- [ ] **Step 1: Zmodyfikuj `TreeItem.vue` — dodaj draggable**

W `<template>`, znajdź `<div v-if="node.type === 'dir'" class="dir-item" @click="toggle">`. Dodaj atrybuty:

```vue
<div v-if="node.type === 'dir'"
     class="dir-item"
     draggable="true"
     @click="toggle"
     @dragstart="onDragStart"
     @dragend="onDragEnd">
```

I dla pliku — `<div v-else-if="node.type === 'file'" class="file-item" ...>`:

```vue
<div v-else-if="node.type === 'file'"
     class="file-item"
     draggable="true"
     :class="{ active: currentPath === node.path }"
     @click="$emit('open', node)"
     @dragstart="onDragStart"
     @dragend="onDragEnd">
```

- [ ] **Step 2: Dodaj funkcje DnD w `<script setup>`**

```typescript
import { useGroupsStore } from '../stores/groups'
const groupsStore = useGroupsStore()

function onDragStart(e: DragEvent) {
  groupsStore.draggingPath = props.node.path
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', props.node.path)
  }
}

function onDragEnd() {
  groupsStore.draggingPath = null
}
```

- [ ] **Step 3: Uruchom dev i przetestuj**

Złap plik / katalog z drzewa i upuść na nagłówek grupy. Sprawdź:
- Pojawia się highlight (border) na grupie podczas hover
- Po upuszczeniu element pojawia się w grupie
- Powtórne upuszczenie tego samego pliku do tej samej grupy nie tworzy duplikatu

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/TreeItem.vue
git commit -m "feat(frontend): drag & drop files from tree to groups"
```

---

## Task 10: Frontend — wskaźnik koloru w drzewie

**Files:**
- Modify: `apps/frontend/src/components/TreeItem.vue`

- [ ] **Step 1: Dodaj computed dla koloru grupy**

W `<script setup>` `TreeItem.vue`:

```typescript
import { computed } from 'vue'
// ... existing imports

const groupColorIndicator = computed(() => {
  const groups = groupsStore.groupsByPath.get(props.node.path)
  if (!groups || groups.length === 0) return null
  return { color: groups[0].color, name: groups[0].name }
})
```

- [ ] **Step 2: Wstaw kwadracik w `<template>`**

W `.dir-item` na końcu (po `<span class="dir-name">`):

```vue
<span v-if="groupColorIndicator"
      class="group-indicator"
      :style="{ background: groupColorIndicator.color }"
      :title="groupColorIndicator.name" />
```

W `.file-item` przed `.change-dot` (lub po, dowolnie):

```vue
<span v-if="groupColorIndicator"
      class="group-indicator"
      :style="{ background: groupColorIndicator.color }"
      :title="groupColorIndicator.name" />
```

- [ ] **Step 3: Dodaj styl**

W `<style scoped>` `TreeItem.vue`:

```css
.group-indicator {
  width: 8px;
  height: 8px;
  border-radius: 1px;
  flex-shrink: 0;
  margin-left: auto;
}
```

(Uwaga: jeśli już jest `margin-left: auto` na `.change-dot`, zachowaj kolejność: `.group-indicator` przed `.change-dot`, oba `flex-shrink: 0`. Drugi w rzędzie nie potrzebuje `margin-left: auto`.)

Adjust istniejące `.change-dot`:

```css
.change-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
  /* margin-left: auto; — usuń, bo group-indicator już to ma */
}
```

Dla `.dir-item` upewnij się że `display: flex` i `align-items: center` są ustawione (już są w istniejącym kodzie).

- [ ] **Step 4: Sprawdź wizualnie**

Dodaj plik do grupy → w drzewie pojawia się kolorowy kwadracik przy nazwie. Hover pokazuje tooltip z nazwą grupy.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/TreeItem.vue
git commit -m "feat(frontend): show group color indicator next to tree items"
```

---

## Task 11: Frontend — `ContextMenu` komponent

**Files:**
- Create: `apps/frontend/src/components/ContextMenu.vue`

- [ ] **Step 1: Utwórz `ContextMenu.vue`**

```vue
<!-- apps/frontend/src/components/ContextMenu.vue -->
<template>
  <Teleport to="body">
    <div v-if="visible"
         class="cm-backdrop"
         @click="close"
         @contextmenu.prevent="close">
      <div class="cm" :style="{ left: clampedX + 'px', top: clampedY + 'px' }" @click.stop>
        <button class="cm-item" @click="onOpen">Otwórz</button>
        <div class="cm-sep" />
        <div class="cm-section-label">Dodaj do grupy</div>
        <button v-for="g in groupsStore.recentGroups" :key="g.id"
                class="cm-item cm-group" @click="addTo(g.id)">
          <span class="dot" :style="{ background: g.color }" />
          <span>{{ g.name }}</span>
        </button>
        <div v-if="!groupsStore.recentGroups.length" class="cm-empty">brak ostatnio używanych</div>
        <button class="cm-item cm-link" @click="$emit('show-dialog')">Pokaż wszystkie grupy…</button>
        <template v-if="belongsToAnyGroup">
          <div class="cm-sep" />
          <button class="cm-item cm-danger" @click="removeFromAll">Usuń ze wszystkich grup</button>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch, nextTick, ref } from 'vue'
import { useGroupsStore } from '../stores/groups'

const props = defineProps<{
  visible: boolean
  x: number
  y: number
  path: string
  isFile: boolean
}>()

const emit = defineEmits<{
  close: []
  open: []
  'show-dialog': []
}>()

const groupsStore = useGroupsStore()

const clampedX = ref(props.x)
const clampedY = ref(props.y)

watch(() => [props.visible, props.x, props.y], async () => {
  if (!props.visible) return
  await nextTick()
  const W = 220, H = 240
  clampedX.value = Math.min(props.x, window.innerWidth - W - 8)
  clampedY.value = Math.min(props.y, window.innerHeight - H - 8)
}, { immediate: true })

const belongsToAnyGroup = computed(() => !!groupsStore.groupsByPath.get(props.path)?.length)

function close() { emit('close') }
function onOpen() { emit('open'); emit('close') }

async function addTo(groupId: number) {
  await groupsStore.addItem(groupId, props.path)
  emit('close')
}

async function removeFromAll() {
  await groupsStore.removeFromAllGroups(props.path)
  emit('close')
}
</script>

<style scoped>
.cm-backdrop {
  position: fixed; inset: 0; z-index: 500;
}
.cm {
  position: absolute;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 4px;
  min-width: 200px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  font-size: 0.82rem;
}
.cm-item {
  display: flex; align-items: center; gap: 8px;
  width: 100%; text-align: left;
  background: none; border: none;
  padding: 6px 10px; border-radius: 4px;
  color: var(--text-primary); cursor: pointer;
  font-size: inherit;
}
.cm-item:hover { background: var(--bg-hover); }
.cm-sep { height: 1px; background: var(--border); margin: 3px 0; }
.cm-section-label {
  padding: 4px 10px;
  color: var(--text-secondary);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.cm-group .dot { width: 9px; height: 9px; border-radius: 2px; flex-shrink: 0; }
.cm-link { color: var(--accent); font-size: 0.78rem; }
.cm-danger { color: #ef4444; }
.cm-empty {
  padding: 4px 10px; color: var(--text-secondary); font-size: 0.72rem;
  opacity: 0.6; font-style: italic;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/components/ContextMenu.vue
git commit -m "feat(frontend): ContextMenu component with Teleport"
```

---

## Task 12: Frontend — `GroupDialog` komponent

**Files:**
- Create: `apps/frontend/src/components/GroupDialog.vue`

- [ ] **Step 1: Utwórz `GroupDialog.vue`**

```vue
<!-- apps/frontend/src/components/GroupDialog.vue -->
<template>
  <Teleport to="body">
    <div class="dlg-backdrop" @click.self="$emit('close')" @keydown.escape="$emit('close')">
      <div class="dlg" tabindex="-1" ref="root">
        <h3 class="dlg-title">Wybierz grupę</h3>
        <div class="dlg-subtitle">Dodajesz: <strong>{{ path }}</strong></div>

        <div class="dlg-list">
          <button v-for="g in groupsStore.groups" :key="g.id"
                  class="dlg-row" :class="{ selected: selected.has(g.id) }"
                  @click="toggle(g.id)">
            <span class="dot" :style="{ background: g.color }" />
            <span class="name">{{ g.name }}</span>
            <span v-if="selected.has(g.id)" class="check">✓</span>
          </button>
          <div v-if="!groupsStore.groups.length" class="dlg-empty">Brak grup. Utwórz pierwszą w sidebarze.</div>
        </div>

        <div class="dlg-actions">
          <button class="btn btn-ghost" @click="$emit('close')">Anuluj</button>
          <button class="btn btn-primary" @click="save">Zapisz</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGroupsStore } from '../stores/groups'

const props = defineProps<{ path: string }>()
const emit = defineEmits<{ close: [] }>()

const groupsStore = useGroupsStore()
const root = ref<HTMLDivElement | null>(null)

const initialMembership = new Set<number>(
  (groupsStore.groupsByPath.get(props.path) ?? []).map((g) => g.id)
)
const selected = ref(new Set(initialMembership))

onMounted(() => root.value?.focus())

function toggle(id: number) {
  if (selected.value.has(id)) selected.value.delete(id)
  else selected.value.add(id)
  // Trigger reactivity
  selected.value = new Set(selected.value)
}

async function save() {
  for (const id of selected.value) {
    if (!initialMembership.has(id)) await groupsStore.addItem(id, props.path)
  }
  for (const id of initialMembership) {
    if (!selected.value.has(id)) {
      const group = groupsStore.groups.find((g) => g.id === id)
      const item = group?.items.find((i) => i.path === props.path)
      if (item) await groupsStore.removeItem(id, item.id)
    }
  }
  emit('close')
}
</script>

<style scoped>
.dlg-backdrop {
  position: fixed; inset: 0; z-index: 600;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
}
.dlg {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 18px;
  width: 320px; max-width: 90vw;
  max-height: 70vh; overflow-y: auto;
  box-shadow: 0 12px 40px rgba(0,0,0,0.6);
  outline: none;
}
.dlg-title { font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
.dlg-subtitle { font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 14px; word-break: break-word; }
.dlg-list { display: flex; flex-direction: column; gap: 5px; margin-bottom: 16px; }
.dlg-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 5px;
  cursor: pointer;
  text-align: left;
  font-size: 0.85rem;
  color: var(--text-primary);
}
.dlg-row:hover { background: var(--bg-hover); }
.dlg-row.selected { border-color: var(--accent); background: var(--bg-hover); }
.dlg-row .dot { width: 11px; height: 11px; border-radius: 2px; flex-shrink: 0; }
.dlg-row .name { flex: 1; }
.dlg-row .check { color: var(--accent); font-weight: 700; }
.dlg-empty { padding: 12px; color: var(--text-secondary); font-size: 0.78rem; text-align: center; }
.dlg-actions { display: flex; gap: 8px; justify-content: flex-end; }
.btn {
  padding: 6px 14px; border-radius: 4px; font-size: 0.8rem; cursor: pointer; border: 1px solid transparent;
}
.btn-ghost { background: transparent; border-color: var(--border); color: var(--text-secondary); }
.btn-ghost:hover { color: var(--text-primary); }
.btn-primary { background: var(--accent); color: #fff; font-weight: 600; }
.btn-primary:hover { background: var(--accent-hover); }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/components/GroupDialog.vue
git commit -m "feat(frontend): GroupDialog modal with toggle membership"
```

---

## Task 13: Frontend — wpięcie ContextMenu i Dialog w TreeItem

**Files:**
- Modify: `apps/frontend/src/components/TreeItem.vue`

- [ ] **Step 1: Dodaj `@contextmenu` do dir-item i file-item**

```vue
<div v-if="node.type === 'dir'"
     class="dir-item"
     draggable="true"
     @click="toggle"
     @dragstart="onDragStart"
     @dragend="onDragEnd"
     @contextmenu.prevent="openContextMenu">
```

```vue
<div v-else-if="node.type === 'file'"
     class="file-item"
     draggable="true"
     :class="{ active: currentPath === node.path }"
     @click="$emit('open', node)"
     @dragstart="onDragStart"
     @dragend="onDragEnd"
     @contextmenu.prevent="openContextMenu">
```

- [ ] **Step 2: Dodaj rendering ContextMenu i Dialog na końcu `<template>`**

Po `</li>` zewnętrznym (czyli na końcu, ale wewnątrz template):

```vue
  </li>

  <ContextMenu
    :visible="cmVisible"
    :x="cmX"
    :y="cmY"
    :path="node.path"
    :is-file="node.type === 'file'"
    @close="cmVisible = false"
    @open="$emit('open', node)"
    @show-dialog="openDialog"
  />

  <GroupDialog v-if="dlgVisible" :path="node.path" @close="dlgVisible = false" />
</template>
```

(Uwaga: zewnętrzny element to `<li>`. Vue 3 wspiera fragmenty więc obok `<li>` mogą być `<ContextMenu>` i `<GroupDialog>`. Jeśli wymaga single root, wrap w `<template>` ze wzorcem Fragment.)

Jeśli twój linter nie lubi multi-root, owiń wszystko w `<>`...`</>` (Vue 3 fragment) lub po prostu pozostaw — Vue 3 akceptuje multiple root nodes.

- [ ] **Step 3: Dodaj logikę w `<script setup>`**

```typescript
import ContextMenu from './ContextMenu.vue'
import GroupDialog from './GroupDialog.vue'

const cmVisible = ref(false)
const cmX = ref(0)
const cmY = ref(0)
const dlgVisible = ref(false)

function openContextMenu(e: MouseEvent) {
  cmX.value = e.clientX
  cmY.value = e.clientY
  cmVisible.value = true
}

function openDialog() {
  cmVisible.value = false
  dlgVisible.value = true
}
```

- [ ] **Step 4: Sprawdź wizualnie**

PPM na pliku → menu z opcjami. Klik na grupę z listy ostatnich → plik dodany. Klik "Pokaż wszystkie grupy…" → dialog. Klik "Usuń ze wszystkich grup" gdy plik jest w grupach → usuwa.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/TreeItem.vue
git commit -m "feat(frontend): wire ContextMenu and GroupDialog into TreeItem"
```

---

## Task 14: Theme — "Deep Night"

**Files:**
- Modify: `apps/frontend/src/style.css`
- Modify: `apps/frontend/src/stores/settings.ts`
- Modify: `apps/frontend/src/components/SettingsPanel.vue`
- Modify: `apps/frontend/src/components/ThemeToggle.vue`

- [ ] **Step 1: Dodaj paletę "Deep Night" w `style.css`**

W `apps/frontend/src/style.css`, po bloku `[data-theme="light"] { ... }`, dodaj:

```css
/* Deep Night theme */
[data-theme="deep-night"] {
  --bg-primary:    #0f0f23;
  --bg-elevated:   #1e1e38;
  --bg-sidebar:    #1a1a2e;
  --bg-hover:      #2a2a4e;
  --text-primary:  #e2e8f0;
  --text-secondary:#94a3b8;
  --accent:        #c084fc;
  --accent-hover:  #a855f7;
  --progress-fill: #c084fc;
  --progress-bg:   #2d2d4e;
  --border:        #2d2d4e;
  --neutral-700:   #3d3d5e;
  --code-bg:       #1a1a2e;
}
```

- [ ] **Step 2: Rozszerz settings store o theme**

Otwórz `apps/frontend/src/stores/settings.ts`:

```typescript
export type CheckedStyle = 'strikethrough' | 'dim' | 'color' | 'none'
export type ContentWidth = 'narrow' | 'medium' | 'wide' | 'full'
export type Theme = 'dark' | 'light' | 'deep-night'

const STORAGE_KEY = 'notatnik-settings'
const THEME_KEY = 'notatnik-theme'

const CONTENT_WIDTH_VALUES: Record<ContentWidth, string> = {
  narrow: '900px',
  medium: '1200px',
  wide: '1600px',
  full: '100%',
}

interface Settings {
  checkedStyle: CheckedStyle
  contentWidth: ContentWidth
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        checkedStyle: parsed.checkedStyle ?? 'strikethrough',
        contentWidth: parsed.contentWidth ?? 'narrow',
      }
    }
  } catch { /* ignore */ }
  return { checkedStyle: 'strikethrough', contentWidth: 'narrow' }
}

function save(state: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function loadTheme(): Theme {
  const t = localStorage.getItem(THEME_KEY)
  if (t === 'light' || t === 'deep-night' || t === 'dark') return t
  return 'dark'
}

export const useSettingsStore = defineStore('settings', () => {
  const initial = load()
  const checkedStyle = ref<CheckedStyle>(initial.checkedStyle)
  const contentWidth = ref<ContentWidth>(initial.contentWidth)
  const theme = ref<Theme>(loadTheme())

  watch([checkedStyle, contentWidth], () => {
    save({ checkedStyle: checkedStyle.value, contentWidth: contentWidth.value })
    applyToDOM()
  })

  watch(theme, (t) => {
    localStorage.setItem(THEME_KEY, t)
    document.documentElement.dataset.theme = t
  })

  function applyToDOM() {
    document.documentElement.dataset.checkedStyle = checkedStyle.value
    document.documentElement.dataset.theme = theme.value
    document.documentElement.style.setProperty(
      '--content-max-width',
      CONTENT_WIDTH_VALUES[contentWidth.value],
    )
  }

  applyToDOM()

  return { checkedStyle, contentWidth, theme }
})
```

- [ ] **Step 3: Dodaj wybór motywu w `SettingsPanel.vue`**

W `<template>` `SettingsPanel.vue`, dodaj kolejny `<fieldset class="setting-group">` po istniejących:

```vue
<fieldset class="setting-group">
  <legend>Motyw</legend>
  <label v-for="opt in themeOptions" :key="opt.value" class="radio-label">
    <input type="radio" :value="opt.value" v-model="settings.theme" />
    <span class="radio-visual" />
    <span class="radio-text">
      <span class="radio-title">{{ opt.label }}</span>
      <span class="radio-desc">{{ opt.desc }}</span>
    </span>
  </label>
</fieldset>
```

W `<script setup>`:

```typescript
const themeOptions = [
  { value: 'dark' as const, label: 'Ciemny', desc: 'Domyślny ciemny motyw' },
  { value: 'light' as const, label: 'Jasny', desc: 'Jasne tło' },
  { value: 'deep-night' as const, label: 'Deep Night', desc: 'Fioletowo-niebieski (paleta z mockupu)' },
]
```

- [ ] **Step 4: Uprość `ThemeToggle.vue` — używaj store zamiast osobnego klucza localStorage**

Zastąp `<script setup>`:

```typescript
import { computed } from 'vue'
import { useSettingsStore } from '../stores/settings'

const settings = useSettingsStore()
const isDark = computed(() => settings.theme !== 'light')

function toggle() {
  settings.theme = settings.theme === 'light' ? 'dark' : 'light'
}
```

(Toggle nadal cyklem dark/light — Deep Night dostępny tylko z SettingsPanel.)

- [ ] **Step 5: Sprawdź wizualnie**

Otwórz Settings → wybierz "Deep Night" → tło i akcenty zmieniają się na palette z mockupu.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/style.css \
        apps/frontend/src/stores/settings.ts \
        apps/frontend/src/components/SettingsPanel.vue \
        apps/frontend/src/components/ThemeToggle.vue
git commit -m "feat(frontend): add Deep Night theme with color palette"
```

---

## Task 15: End-to-end smoke test (manual)

**Files:** brak zmian — manualny test pełnego przepływu

- [ ] **Step 1: Uruchom dev**

```bash
cd /home/perun/Code/notatnik.md
bun --cwd apps/api dev
# w drugim terminalu:
bun --cwd apps/frontend dev
```

- [ ] **Step 2: Przejdź pełny scenariusz**

1. Ustaw vault (lub użyj istniejącego).
2. Sekcja "Grupy" pusta — kliknij `+`, wybierz fioletowy, wpisz "Projekt Test", Enter.
3. Grupa pojawia się rozwinięta, pusta.
4. Przeciągnij `PRD.md` z drzewa do nagłówka grupy. Element pojawia się w grupie. Przy `PRD.md` w drzewie — fioletowy kwadracik.
5. PPM na innym pliku → klik "Projekt Test" w sekcji "Dodaj do grupy" (powinien być w ostatnich, bo właśnie był używany). Plik dodany.
6. PPM na trzecim pliku → "Pokaż wszystkie grupy…" → zaznacz "Projekt Test" → Zapisz. Plik dodany.
7. PPM na pliku z grupy → "Usuń ze wszystkich grup". Kwadracik znika z drzewa, plik znika z grupy.
8. Klik `×` na nagłówku grupy → potwierdź → grupa usunięta.
9. Otwórz Settings → wybierz "Deep Night" → tło zmienia się na fioletowo-niebieskie.
10. Restart strony — wszystkie ustawienia (motyw, grupy) trwałe.

- [ ] **Step 3: Uruchom wszystkie testy**

```bash
bun --cwd apps/api test
bun --cwd apps/frontend test
bun --cwd apps/frontend run build
```

Expected: wszystkie passują, build success.

- [ ] **Step 4: Final commit (jeśli były poprawki)**

Jeśli scenariusz wykrył drobne błędy — popraw, commituj jako osobny commit `fix(...)`.

---

## Self-Review Checklist (engineer running plan)

Przed oznaczeniem planu jako ukończonego:

- [ ] Wszystkie spec sections pokryte (1–10):
  - §1 Cel — Task 8, 9, 13 (UX implementation)
  - §2 Layout — Task 8 (Sidebar)
  - §3 Grupy — Task 8 (create/list/delete), 9 (DnD), 10 (paleta)
  - §4 Menu kontekstowe — Task 11, 13
  - §5 Dialog — Task 12, 13
  - §6 Wskaźnik koloru — Task 10
  - §7 Storage — Task 2 (DB), 3–6 (API)
  - §8 Frontend — Task 7 (store), 8–13 (komponenty)
  - §9 Motyw "Deep Night" — Task 14
  - §10 Out-of-scope — nie implementujemy
- [ ] Brak placeholderów ("TBD", "TODO", "fill in") w kodzie
- [ ] Wszystkie testy passują
- [ ] Build success
- [ ] Manualne smoke test przeszedł

---

## Notatki dla implementatora

- **Pamiętaj o WAL files w gitignore** — `.db-wal`, `.db-shm` są w Task 2 step 3.
- **Kolejność routes w Hono** — w Task 6 step 2 jest pułapka: `delete('/items/by-path')` musi iść przed `delete('/:id')`.
- **`groupsStore.draggingPath`** to globalny stan dla DnD — alternatywą byłby `dataTransfer.getData()`, ale w niektórych przeglądarkach nie da się odczytać podczas `dragover` (tylko w `drop`), a do `drag-over` highlight potrzebujesz wiedzieć już w `dragover`. Reaktywna zmienna w store jest prostsza i działa wszędzie.
- **`groupsByPath`** jest computed — przy zmianie `groups` całość się przelicza. Dla typowych vaultów (kilkadziesiąt grup × kilkanaście elementów) to nieistotne. Przy 10000+ elementów warto zoptymalizować, ale to poza scope.
- **CodeGraph** — projekt ma `.codegraph/`. Nie używaj `codegraph_explore` ani `codegraph_context` w main session — wszystkie wymagane informacje są w tym planie. Użyj `codegraph_search`/`codegraph_callers` tylko jeśli musisz znaleźć symbol przed edycją.
