# notatnik.md — Design Spec
**Data:** 2026-03-27 | **Stack:** Bun / Hono / TypeScript / Vue 3 / Vite

---

## 1. Cel i zakres

Lokalna aplikacja webowa do przeglądania plików Markdown z wybranego katalogu (vault). Render-only (bez edycji), z hierarchicznym liczeniem checkboxów i progress barami na 4 poziomach, auto-odświeżaniem przez SSE + filesystem watcher, oraz przełącznikiem dark/light theme.

---

## 2. Struktura projektu (Bun workspaces monorepo)

```
notatnik.md/
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts          ← Hono server, port 3001
│   │       ├── watcher.ts        ← chokidar singleton
│   │       └── routes/
│   │           ├── vault.ts      ← GET/POST /api/vault
│   │           ├── files.ts      ← GET /api/files, GET /api/files/:name
│   │           └── sse.ts        ← GET /api/sse
│   └── frontend/
│       ├── package.json
│       ├── vite.config.ts        ← proxy /api → localhost:3001
│       └── src/
│           ├── main.ts
│           ├── App.vue
│           ├── router/index.ts
│           ├── views/
│           │   ├── HomeView.vue  ← vault picker + welcome
│           │   └── FileView.vue  ← viewer pliku .md
│           ├── components/
│           │   ├── Sidebar.vue
│           │   ├── MarkdownRenderer.vue
│           │   ├── ProgressBar.vue
│           │   └── ThemeToggle.vue
│           └── stores/
│               ├── vault.ts      ← Pinia: vault path, file list
│               └── sse.ts        ← Pinia: SSE connection, events
├── packages/
│   └── shared/
│       ├── package.json
│       └── types.ts              ← FileInfo, VaultConfig, SseEvent, MdNode
├── package.json                  ← Bun workspaces root
├── settings.json                 ← vault path persistence (gitignored)
└── PRD.md
```

---

## 3. API

| Method | Path | Opis | Odpowiedź |
|---|---|---|---|
| GET | `/api/vault` | Zwróć aktualną konfigurację vaultu | `{ path: string }` |
| POST | `/api/vault` | Ustaw nową ścieżkę vaultu | `{ path: string }` |
| GET | `/api/files` | Lista plików `.md` | `FileInfo[]` |
| GET | `/api/files/:name` | Treść pliku | `text/markdown` + ETag |
| GET | `/api/sse` | SSE stream zdarzeń | event stream |

### Vault persistence
Ścieżka przechowywana w pamięci serwera + `settings.json` w root projektu. Przy starcie serwera — odczyt z `settings.json` jeśli istnieje.

### ETag
`GET /api/files/:name` zwraca nagłówki:
- `ETag: "<mtimeMs>"`
- `Last-Modified`
- `Cache-Control: no-cache`

Jeśli klient wyśle `If-None-Match` z aktualnym ETag → `304 Not Modified`.

### SSE events
```
data: {"type":"file:changed","filename":"notatki.md"}\n\n
data: {"type":"file:added","filename":"nowy.md"}\n\n
data: {"type":"file:removed","filename":"stary.md"}\n\n
data: {"type":"vault:changed","path":"/nowa/sciezka"}\n\n
data: ping\n\n   ← heartbeat co 30s
```

---

## 4. Filesystem Watcher

- Biblioteka: `chokidar`
- Singleton w `watcher.ts` — jeden watcher na cały vault
- Reset watchera przy zmianie vault path (`POST /api/vault`)
- Zdarzenia: `add`, `change`, `unlink` → broadcast SSE do wszystkich połączonych klientów
- Filtr: tylko pliki `.md`

---

## 5. Parser Markdown (frontend, Vue)

### 5.1 Drzewo AST

```typescript
interface MdDocument {
  progress: Progress        // cały dokument
  chapters: MdChapter[]
}

interface MdChapter {       // ## heading
  title: string
  progress: Progress
  sections: MdSection[]
  items: MdItem[]           // items przed pierwszą ### sekcją
}

interface MdSection {       // ### heading
  title: string
  progress: Progress
  subsections: MdSubsection[]
  items: MdItem[]
}

interface MdSubsection {    // #### heading
  title: string
  progress: Progress
  items: MdItem[]
}

interface MdItem {
  type: 'task' | 'text' | 'table' | 'code'
  text?: string
  checked?: boolean         // tylko dla type === 'task'
  hash?: number             // djb2 hash tekstu zadania (dla localStorage)
  rows?: string[][]         // tylko dla type === 'table'
}

interface Progress {
  total: number
  checked: number
  pct: number               // 0–100, zaokrąglone
}
```

### 5.2 Reguły parsowania checkboxów

Checked: `- [x]`, `- ✅`
Unchecked: `- [ ]`, `- ⏳`, `- ❌`, `- 🔜`

Wykluczone z parsowania jako checkbox:
- Wiersze tabel (linia zaczyna się od `|`)
- Linie wewnątrz bloków kodu (między ` ``` ` fences)
- Linie nie zaczynające się od `- `

### 5.3 Inline Markdown

`**bold**` → `<strong>`, `*em*` → `<em>`, `` `code` `` → `<code>`, `[text](url)` → `<a target="_blank">`

### 5.4 Tabele

Linie zaczynające się od `|` zbierane w blok. Rząd separatora (`|---|---|`) filtrowany. Pierwsza linia → `<thead>`, pozostałe → `<tbody>`.

### 5.5 Stan checkboxów — localStorage

Klucz: `notatnik-progress-<filename>` → obiekt `{ [djb2hash]: boolean }`.
Hash: `djb2(itemText)` — `Math.imul(31, h) + charCode | 0`.
Odporny na zmiany kolejności linii w pliku.

---

## 6. Progress Bary — 4 poziomy

| Poziom | Element | Pozycja w UI |
|---|---|---|
| Dokument | cały plik | sticky pod navbarem (top: 56px) |
| Rozdział `##` | każdy rozdział | sticky nagłówek rozdziału |
| Sekcja `###` | każda sekcja | inline pod nagłówkiem |
| Podsekcja `####` | każda podsekcja | inline, mniejszy pasek |

Progress bar komponent: `<ProgressBar :total="n" :checked="k" :label="title" />`
Renderuje: `[████████░░] 80% (8/10)`

---

## 7. SSE — Frontend

Pinia store `sse.ts`:
- `new EventSource('/api/sse')` przy starcie app
- `file:changed` + aktualny plik → `GET /api/files/:name` (z ETag) → reparse → update progress
- `file:added` / `file:removed` → refresh listy plików w sidebarze
- `vault:changed` → pełny refresh
- `onerror` → reopen po 3s (manual retry)

---

## 8. Layout

```
┌─────────────────────────────────────────────────┐
│  navbar: logo | vault path input | theme toggle │  fixed 56px, z-index: 100
├──────────────┬──────────────────────────────────┤
│              │  ┌─ progress doc (sticky) ──────┐ │  sticky top: 56px
│   Sidebar    │  │  ████████░░  70% (14/20)     │ │
│   240px      │  └──────────────────────────────┘ │
│   fixed      │                                  │
│              │  ## Rozdział  ██████░░ 62%       │  sticky section header
│  lista .md   │  ### Sekcja  ████░░░ 60%         │  inline
│  plików      │  - [x] zadanie                   │
│              │  - [ ] zadanie                   │
└──────────────┴──────────────────────────────────┘
```

**CSS Grid root:** `grid-template-columns: 240px 1fr`

**Sticky stack:**
- Navbar: `position: fixed; top: 0; height: 56px; z-index: 100`
- Progress doc: `position: sticky; top: 64px; z-index: 15; backdrop-filter: blur(18px)`
- Section headers: `position: sticky; top: ~150px; z-index: 10`
- `.section-card` musi mieć `overflow: clip` (nie `hidden`) — sticky działa poprawnie

---

## 9. Theme System

CSS custom properties na `<html data-theme="dark|light">`.

| Token | Dark | Light |
|---|---|---|
| `--bg-primary` | `#0f0e0d` | `#fafaf9` |
| `--bg-elevated` | `#1a1917` | `#ffffff` |
| `--bg-sidebar` | `#141311` | `#f0eeea` |
| `--text-primary` | `#e8e6e1` | `#1c1b19` |
| `--text-secondary` | `#a09d96` | `#6b6860` |
| `--accent` | `#f59e0b` | `#d97706` |
| `--progress-fill` | `#f59e0b` | `#d97706` |
| `--progress-bg` | `#2a2825` | `#e5e3de` |
| `--neutral-700` | `#3a3835` | `#d1cfc9` |

Toggle: klik → `document.documentElement.dataset.theme = 'light'|'dark'` + `localStorage['notatnik-theme']`. Default: dark.

---

## 10. Vault Path Input (Navbar)

- `<input type="text" placeholder="/ścieżka/do/katalogu">`
- Historia ostatnich 5 ścieżek w `localStorage['notatnik-vault-history']`
- Enter lub klik "Otwórz" → `POST /api/vault` → SSE `vault:changed` → refresh
- Walidacja: backend sprawdza czy ścieżka istnieje i jest katalogiem, zwraca `400` jeśli nie

---

## 11. Sidebar

- Lista plików `.md` z `GET /api/files` (bez rozszerzenia w label)
- Aktywny plik: podświetlenie akcentem
- Dot indicator: pomarańczowa kropka gdy `file:changed` dotyczy nieaktywnego pliku
- Klik → Vue Router push `/:filename`

---

## 12. Shared Types (`packages/shared/types.ts`)

```typescript
export interface FileInfo {
  name: string        // bez rozszerzenia .md
  filename: string    // z rozszerzeniem
  mtime: number
  size: number
}

export interface VaultConfig {
  path: string
}

export type SseEvent =
  | { type: 'file:changed'; filename: string }
  | { type: 'file:added'; filename: string }
  | { type: 'file:removed'; filename: string }
  | { type: 'vault:changed'; path: string }
```

---

## 13. Dev Setup

```bash
bun install              # install all workspaces
bun run dev              # uruchamia api + frontend równolegle
```

Root `package.json` scripts:
```json
{
  "scripts": {
    "dev": "bun run --filter '*' dev",
    "build": "bun run --filter '*' build"
  }
}
```

Vite proxy (`vite.config.ts`):
```typescript
proxy: { '/api': 'http://localhost:3001' }
```
