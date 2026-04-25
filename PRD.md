# notatnik.md — Product Requirements Document

**Wersja:** 1.0
**Data:** 2026-03-30
**Status:** Aktualny

---

## 1. Cel produktu

notatnik.md to przeglądarka plików Markdown zoptymalizowana pod listy zadań i notatki z checkboxami. Pozwala wskazać lokalny katalog (vault), przeglądać jego pliki przez interfejs webowy i śledzić postęp wykonania zadań. Aplikacja reaguje na zmiany zewnętrzne (edytor, git) w czasie rzeczywistym — pokazując diff zamiast cichego przeładowania.

---

## 2. Architektura

### Stack technologiczny
- **Backend:** Bun + Hono (TypeScript), port 3001
- **Frontend:** Vue 3 + Pinia + Vue Router + Vite (TypeScript), port 5173 (dev)
- **Monorepo:** Bun workspaces — `apps/api`, `apps/frontend`, `packages/shared`
- **Watcher:** chokidar (rekurencyjny, głębokość nieograniczona)
- **Komunikacja real-time:** Server-Sent Events (SSE)
- **Testy:** bun:test (API), vitest (frontend)
- **Docker:** single-container, Bun + zbudowany frontend, VAULT_PATH env var

### Wdrożenie (Docker)
```bash
docker compose up --build  # dostępna na http://localhost:3010
```
`VAULT_PATH` env var ustawia vault automatycznie — bez konfiguracji przez UI.

---

## 3. Funkcje

### 3.1 Vault — wybór katalogu

Użytkownik wskazuje lokalny katalog z plikami `.md`. Ścieżka jest zapisana server-side (`settings.json`) i pamiętana między sesjami.

- Historia 5 ostatnich vaultów (localStorage), podpowiadana w polu input
- Walidacja: katalog musi istnieć i być katalogiem
- W trybie Docker (`VAULT_PATH` env var): formularz ukryty, vault ustawiony automatycznie
- Pole zmiany vaultu w navbarze (tylko gdy nie readonly)

### 3.2 Drzewo plików

Sidebar pokazuje rekurencyjne drzewo katalogów i plików `.md`.

- Katalogi wyświetlają strzałkę ▾/▸ — rozwijane/zwijane kliknięciem
- Stan rozwinięcia zapamiętany w localStorage per katalog
- Domyślnie katalogi są rozwinięte
- Pliki z zewnętrznymi zmianami (niezaakceptowanymi) wyświetlają **pomarańczową kropkę** (change-dot)
- Aktualnie otwarty plik wyróżniony kolorem akcentu i prawym borderem
- Długie nazwy plików i katalogów zawijają się (nie są obcinane)
- Czcionka plików: 0.8rem, odstępy: 4px, separator dolny między plikami

### 3.3 Wyświetlanie pliku Markdown

Parser czyta plik i buduje strukturę hierarchiczną:

```
MdDocument
  ├── items[]         (treść przed pierwszym ##)
  └── chapters[]      (## nagłówki)
        ├── items[]
        └── sections[]    (### nagłówki)
              ├── items[]
              └── subsections[]   (#### nagłówki)
                    └── items[]
```

**Typy itemów:**
- **task** — checkbox (`- [ ]`, `- [x]`, emoji: ✅ ⏳ ❌ 🔜)
- **text** — akapit z inline formatowaniem (`**bold**`, `*italic*`, `` `code` ``, `[link](url)`)
- **table** — tabela HTML z headerem
- **code** — blok kodu z podświetlaniem składni (highlight.js)

**Sticky headers** — przy przewijaniu:
- Progress bar dokumentu: `top: 0` (z-index 15)
- Nagłówek rozdziału (##): `top: 54px` (z-index 10)
- Nagłówek sekcji (###): `top: 134px` (z-index 9)
- Nagłówek podsekcji (####): `top: 188px` (z-index 8)

Wszystkie sticky headery używają `backdrop-filter: blur` i przezroczystego tła dla kontrastu z treścią.

### 3.4 Śledzenie postępu zadań

Każdy poziom hierarchii ma pasek postępu.

- Obliczanie bottom-up: subsection → section → chapter → document
- Stan checkboxów zapisany w localStorage (hash DJB2 per task)
- Kliknięcie checkboxa: aktualizuje stan, zapisuje do localStorage, przelicza postęp
- Wyświetlenie: `X% (checked/total)` + kolorowy pasek

### 3.5 Powiadomienia o zmianach zewnętrznych

Gdy plik zmienia się poza aplikacją (edytor, git):

**Plik aktualnie otwarty:**
1. SSE event `file:changed` lub `file:added` (rename)
2. Pobiera nową wersję z API
3. Oblicza diff LCS względem poprzedniego tekstu (`rawText`)
4. Jeśli brak różnic → cichy reload
5. Jeśli są zmiany → wyświetla **panel diffa** z przyciskami "Zaakceptuj" / "Zamknij"

**Plik nieotwarty:**
- Wyświetla pomarańczową kropkę (change-dot) przy pliku w sidebarze

**Wejście w zmieniony plik:**
- Jeśli plik był wcześniej otwarty w tej sesji → automatycznie pokazuje diff (snapshot starej treści vs nowej)
- Jeśli plik nie był otwarty → ładuje normalnie

### 3.6 Panel diffa

Pojawia się nad treścią pliku gdy wykryta zostanie zewnętrzna zmiana.

```
┌─────────────────────────────────────────────────────┐
│ ⚡ Plik zaktualizowany          [Zamknij] [Zaakceptuj] │
├─────────────────────────────────────────────────────┤
│   wiersz kontekstu                                  │
│ - usunięta linia                       (czerwony bg)│
│ + dodana linia                          (zielony bg)│
│   wiersz kontekstu                                  │
│ ···                                      (separator)│
└─────────────────────────────────────────────────────┘
```

- Font: monospace
- Max wysokość: `40vh` z przewijaniem
- Kontekst: 3 linie wokół każdej zmiany (jak `git diff -U3`)
- Separator `···` dla pominiętych niezmienionych bloków
- **"Zaakceptuj"** → aktualizuje dokument nową treścią
- **"Zamknij"** → zachowuje starą treść, panel znika

**Algorytm:** LCS (Longest Common Subsequence) na liniach, O(n²), limit 5000 linii (powyżej — cichy reload).

### 3.7 Tematy wizualne

Przełącznik ciemny/jasny motyw w prawym rogu navbaru.

- Domyślnie: ciemny (`dark`)
- Wybór zapisany w localStorage
- Przełącznik: ikona słońca / księżyca

---

## 4. Wygląd i design

### Kolory (dark theme)

| Token | Wartość | Użycie |
|-------|---------|--------|
| `--bg-primary` | #0f0e0d | Tło główne |
| `--bg-elevated` | #1a1917 | Karty, navbar, diff panel |
| `--bg-sidebar` | #141311 | Sidebar |
| `--bg-hover` | #242220 | Hover stany |
| `--text-primary` | #e8e6e1 | Główny tekst |
| `--text-secondary` | #a09d96 | Tekst pomocniczy, etykiety |
| `--accent` | #f59e0b | Amber — aktywne elementy, progress |
| `--border` | #2a2825 | Obramowania |
| `--code-bg` | #1e1c1a | Tło bloków kodu |

### Typografia
- Tekst interfejsu: `system-ui`
- Kod i diff: `JetBrains Mono / Fira Code / Cascadia Code`
- Zaokrąglenie: `6px`
- Animacje: `150ms ease`

### Wymiary
- Navbar: `56px` wysokości
- Sidebar: `240px` szerokości
- Pasek progress: 6px (doc/chapter), 4px (section), 3px (subsection)

### Wskaźnik połączenia SSE
Zielona kropka (z glow) w navbarze gdy EventSource jest aktywny.

---

## 5. API Backend

| Endpoint | Opis |
|----------|------|
| `GET /api/vault` | Aktualny vault (`{path, readonly}`) |
| `POST /api/vault` | Ustaw vault |
| `GET /api/files` | Drzewo plików (`TreeNode[]`) |
| `GET /api/files/:path` | Treść pliku (z ETag) |
| `GET /api/sse` | Server-Sent Events stream |
| `GET /api/health` | Health check |

Pliki serwowane z ETag (mtime). Obsługa `If-None-Match` → HTTP 304.
Ochrona przed path traversal (`..` w ścieżce).

### SSE Events
- `file:changed` — plik zmieniony
- `file:added` — plik dodany (lub rename — atomic save)
- `file:removed` — plik usunięty
- `vault:changed` — vault zmieniony przez inną instancję
- `ping` — keepalive co 30s

---

## 6. Persystencja (localStorage)

| Klucz | Zawartość |
|-------|-----------|
| `notatnik-vault-history` | JSON array ostatnich 5 ścieżek |
| `notatnik-theme` | `'dark'` \| `'light'` |
| `notatnik-sidebar` | `'open'` \| `'closed'` |
| `notatnik-tree-open:<path>` | Stan rozwinięcia katalogu |
| `notatnik-progress-<filename>` | JSON `{hash: boolean}` checkboxów |

---

## 7. Ograniczenia i znane zachowania

- Diff LCS powyżej 5000 linii → cichy reload (bez diffa)
- Snapshoty treści pliku są in-memory (sesja przeglądarki) — po odświeżeniu strony brak diffa przy nawigacji
- Checkboxy identyfikowane przez hash DJB2 treści — zmiana tekstu taska = nowy hash = utrata stanu
- Pliki nie-`.md` są ignorowane przez API i watcher
- Katalogi bez plików `.md` (bezpośrednio lub w podkatalogach) nie pojawiają się w drzewie
