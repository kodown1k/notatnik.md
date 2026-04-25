# Design: Directory Tree w Sidebar

**Data:** 2026-03-30
**Status:** Zatwierdzony
**Dotyczy:** notatnik.md — przeglądarka plików Markdown

---

## Problem

Aktualnie vault wskazuje na jeden płaski katalog i wyświetla tylko pliki `.md` z jego roota. Użytkownik chce widzieć drzewo podkatalogów razem z plikami `.md` — tak jak eksplorator plików.

---

## Rozwiązanie

Podejście A: Zmiana `GET /api/files` → zwraca pełne drzewo rekurencyjnie. Jeden endpoint, spójna struktura w całej aplikacji.

---

## Typy (`packages/shared/types.ts`)

Zastępujemy `FileInfo` typem `TreeNode`:

```ts
export interface TreeNode {
  type: 'file' | 'dir'
  name: string           // nazwa wyświetlana (bez .md dla plików)
  path: string           // ścieżka relatywna od roota vaultu, np. "docs/notes.md" lub "docs"
  filename?: string      // tylko type=file: z rozszerzeniem .md
  mtime?: number         // tylko type=file
  size?: number          // tylko type=file
  children?: TreeNode[]  // tylko type=dir, posortowane: katalogi najpierw, potem pliki
}
```

`FileInfo` usuwamy — był używany tylko wewnętrznie.

---

## API (`apps/api/src/routes/files.ts`)

### `GET /api/files`

Zwraca `TreeNode[]` — top-level entries z rekurencyjnie wypełnionymi `children`.

Reguły:
- Katalogi bez żadnych `.md` na żadnym poziomie są pomijane
- Sortowanie: najpierw katalogi (alfabetycznie), potem pliki (alfabetycznie)
- Rekurencja bez limitu głębokości (vault jest kontrolowany przez użytkownika)

### `GET /api/files/:path{*}`

Przyjmuje relatywne ścieżki z ukośnikami, np. `docs/notes.md`.

Security — zmiana podejścia:
- Usuwamy blokadę `/` w ścieżce (była dla płaskiego katalogu)
- Zostawiamy blokadę `..`
- Dodajemy weryfikację: `resolve(vault, path).startsWith(resolve(vault) + '/')` po każdej normalizacji
- Weryfikacja symlinka (`realpathSync`) pozostaje bez zmian

---

## Frontend

### Router (`apps/frontend/src/router/index.ts`)

```ts
{ path: '/:path(.*)+', component: FileView }
```

Obsługuje zagnieżdżone ścieżki jak `/docs/notes.md`.

### Store (`apps/frontend/src/stores/vault.ts`)

- `files: FileInfo[]` → `tree: TreeNode[]`
- `changedFiles: Set<string>` — bez zmian, używa relatywnych ścieżek (np. `docs/notes.md`)
- `refreshFiles()` pobiera nową strukturę z `GET /api/files`

### Sidebar (`apps/frontend/src/components/Sidebar.vue`)

Renderowanie rekurencyjne:
- **Katalog**: ikonka `▶/▼` + nazwa, klik toggleuje rozwinięcie
- **Plik**: nazwa bez `.md`, klik → `router.push('/' + node.path)`
- Aktywny plik: podświetlenie jak dotychczas (porównanie z aktualną ścieżką z routera)
- Stan rozwinięcia katalogów: `localStorage` pod kluczem `notatnik-tree-open`
- Domyślnie: top-level katalogi rozwinięte, głębsze zwinięte

### FileView (`apps/frontend/src/views/FileView.vue`)

- `currentFilename` = `route.params.path` (pełna relatywna ścieżka, np. `docs/notes.md`)
- Fetch: `GET /api/files/docs/notes.md`
- Brak innych zmian logiki

---

## Zmiany SSE / watcher

`file:changed`, `file:added`, `file:removed` — eventy już niosą `filename` jako relatywną ścieżkę. Brak zmian w warstwie SSE.

Po `file:added`/`file:removed` store wywołuje `refreshFiles()` żeby odświeżyć drzewo.

---

## Pliki do modyfikacji

| Plik | Zmiana |
|------|--------|
| `packages/shared/types.ts` | `FileInfo` → `TreeNode` |
| `apps/api/src/routes/files.ts` | `GET /` zwraca drzewo; `GET /:path` obsługuje podkatalogi |
| `apps/frontend/src/stores/vault.ts` | `files` → `tree` |
| `apps/frontend/src/components/Sidebar.vue` | Renderowanie drzewa |
| `apps/frontend/src/router/index.ts` | Wildcard route |
| `apps/frontend/src/views/FileView.vue` | `currentFilename` z `route.params.path` |
| `apps/api/src/routes/files.test.ts` | Aktualizacja testów |
