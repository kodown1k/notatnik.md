# notatnik.md

Webowa przeglądarka plików Markdown zoptymalizowana pod listy zadań i notatki z checkboxami. Wskazujesz lokalny katalog (vault), aplikacja serwuje go przez przeglądarkę, śledzi postęp wykonania zadań i reaguje na zewnętrzne zmiany w czasie rzeczywistym — pokazując diff zamiast cichego przeładowania.

## Funkcje

- **Drzewo plików** w sidebarze — rekurencyjne, ze stanem rozwinięcia per katalog (localStorage).
- **Interaktywne checkboxy** — `- [ ]`, `- [x]`, oraz emoji ✅ ⏳ ❌ 🔜. Klik zapisuje stan zarówno do localStorage, jak i do źródłowego pliku `.md` (PATCH `/api/files/:path`).
- **Hierarchiczny progress bar** — postęp liczony bottom-up (subsection → section → chapter → document), sticky headery przy przewijaniu.
- **Markdown renderer** — tabele, bloki kodu z highlight.js, inline `**bold**` / `*italic*` / `` `code` `` / `[link](url)`, diagramy Mermaid.
- **Hot reload przez SSE** — backend obserwuje vault przez chokidar i pcha eventy do frontu. Dla otwartego pliku pokazujemy diff zamiast cichego nadpisania.
- **Historia vaultów** (5 ostatnich), walidacja ścieżki, tryb readonly w Dockerze.

## Stack

- **Backend:** [Bun](https://bun.sh) + [Hono](https://hono.dev), TypeScript, port 3001
- **Frontend:** Vue 3 + Pinia + Vue Router + Vite, port 5173 (dev)
- **Watcher:** [chokidar](https://github.com/paulmillr/chokidar) (rekurencyjny)
- **Real-time:** Server-Sent Events
- **Monorepo:** Bun workspaces — `apps/api`, `apps/frontend`, `packages/shared`
- **Testy:** `bun:test` (API), `vitest` (frontend)

## Struktura

```
.
├── apps/
│   ├── api/         # Hono + Bun, SSE, watcher, /api/files
│   └── frontend/    # Vue 3, parser markdown, store Pinia
├── packages/
│   └── shared/      # wspólne typy TS
├── docs/            # plany i specyfikacje
├── docker-compose.yaml
├── Dockerfile
└── PRD.md           # Product Requirements Document
```

## Uruchomienie — dev

Wymagane: [Bun](https://bun.sh) ≥ 1.2.

```bash
bun install
bun run dev          # uruchamia API (3001) + frontend (5173) równolegle
```

Frontend: http://localhost:5173. API: http://localhost:3001.

## Uruchomienie — Docker

```bash
docker compose up --build
```

Aplikacja na http://localhost:3010. Vault montowany z hosta przez `docker-compose.yaml` (`VAULT_PATH=/vault`). W trybie Docker formularz wyboru vaultu jest ukryty.

## Skróty Bun

```bash
bun run dev                              # wszystkie workspace'y w trybie dev
bun run build                            # build frontu
bun run --filter @notatnik/api test      # testy API
bun run --filter @notatnik/frontend test # testy frontu
```

## Format checkboxów

Parser rozpoznaje wyłącznie linie zaczynające się od `- ` (bez wcięcia):

| Forma         | Stan         |
|---------------|--------------|
| `- [ ] tekst` | unchecked    |
| `- [x] tekst` | checked      |
| `- ⏳ tekst`   | w trakcie    |
| `- ❌ tekst`   | zablokowane  |
| `- 🔜 tekst`   | zaplanowane  |
| `- ✅ tekst`   | checked      |

Pełna specyfikacja parsera i formatu PRD: `PRD.md`.

## Status

Projekt prywatny / hobbystyczny. Bieżący zakres i roadmapa w `PRD.md`.
