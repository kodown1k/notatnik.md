# Grupy plików w sidebarze — Design Spec

**Data:** 2026-05-09
**Status:** Zatwierdzony

---

## 1. Cel

Użytkownik może tworzyć nazwane, kolorowe grupy i przypisywać do nich dowolne pliki oraz katalogi z vaultu. Grupy to wirtualne zakładki — nie zmieniają struktury katalogów na dysku. Pliki pozostają w swoich oryginalnych lokalizacjach w drzewie, ale są też widoczne jako elementy grupy w górnej sekcji sidebara.

---

## 2. Layout sidebara

Sidebar dzieli się na dwie sekcje w jednym scrollu:

1. **Sekcja Grupy** (u góry) — nagłówek z przyciskiem `+`, lista grup jako zwijane/rozwijane sekcje, placeholder drop-zone.
2. **Sekcja Pliki** (poniżej) — istniejące drzewo plików bez zmian, z dodanymi wskaźnikami przynależności do grupy.

Separator między sekcjami to label „Pliki" (uppercase, muted).

---

## 3. Grupy

### 3.1 Tworzenie grupy

- Kliknięcie `+` przy nagłówku „Grupy" otwiera inline formularz bezpośrednio pod nagłówkiem.
- Formularz zawiera: paletę kolorów (5–8 predefiniowanych kolorów jako klikalne kwadraciki) + pole tekstowe na nazwę.
- Zatwierdzenie: Enter lub kliknięcie poza formularz. Anulowanie: Escape.
- Nowa grupa trafia na koniec listy, domyślnie zwinięta.

### 3.2 Usuwanie grupy

- Przycisk `×` widoczny przy hover na nagłówku grupy.
- Usuwa grupę i wszystkie przypisania (pliki wracają do drzewa bez wskaźnika). Nie usuwa plików z dysku.

### 3.3 Zwijanie / rozwijanie

- Stan zwijania zapisywany w `localStorage` (klucz: `notatnik-group-open:<group_id>`).
- Domyślnie: grupy rozwinięte.

### 3.4 Elementy grupy

- Każdy element wyświetla ikonę (📁 katalog / 📄 plik), skróconą ścieżkę względem vaultu, przycisk `×` przy hover (usuwa z grupy, nie z dysku).
- Kliknięcie elementu otwiera plik (jak kliknięcie w drzewie).

### 3.5 Drag & drop

- Implementacja: `@vueuse/core` (`useDropZone` na obszarze grupy, `draggable="true"` + handlery na `TreeItem`).
- Źródło: `TreeItem` (plik lub katalog) — ustawiamy `draggable="true"`, na `dragstart` przekazujemy `node.path` przez `dataTransfer`.
- Cel: każda sekcja grupy i placeholder drop-zone pod listą grup.
- Po upuszczeniu: wywołanie API `POST /api/groups/:id/items`, aktualizacja store.
- Wizualne feedback podczas drag: highlight obramowania drop-zone.

### 3.6 Paleta kolorów

Predefiniowane 8 kolorów (hex):

| Nazwa | Hex |
|---|---|
| Fiolet | `#c084fc` |
| Zieleń | `#34d399` |
| Pomarańcz | `#fb923c` |
| Błękit | `#60a5fa` |
| Róż | `#f472b6` |
| Czerwień | `#f87171` |
| Żółć | `#fbbf24` |
| Indygo | `#818cf8` |

---

## 4. Menu kontekstowe (PPM na pliku / katalogu w drzewie)

Prawoklik na `TreeItem` otwiera menu kontekstowe z pozycjami:

1. **Otwórz plik** — otwiera plik (jak kliknięcie LPM).
2. *(separator)*
3. **Dodaj do grupy** — podmenu inline:
   - Lista ostatnich 3 grup (posortowana wg ostatnio używanych), każda z kolorowym kwadracikiem i nazwą.
   - Link „Pokaż wszystkie grupy…" — otwiera dialog (§5).
4. *(separator)*
5. **Usuń ze wszystkich grup** — widoczne tylko gdy plik należy do co najmniej jednej grupy.

Menu zamyka się przy kliknięciu poza nim lub po wybraniu akcji. Pozycjonowanie: przy kursorze, z clampingiem do viewport.

---

## 5. Dialog wyboru grupy

Otwierany z menu kontekstowego → „Pokaż wszystkie grupy…".

- Modal na środku ekranu, overlay tłumi tło.
- Nagłówek: „Wybierz grupę", podtytuł: „Dodajesz: `<nazwa pliku>`".
- Lista wszystkich grup: każda jako klikalny wiersz z kolorowym kwadracikiem i nazwą. Kliknięcie zaznacza (border + checkmark). Można zaznaczyć tylko jedną.
- Przyciski: „Anuluj" (zamknij bez akcji) i „Dodaj" (zapisz i zamknij).
- Zamknięcie: Escape lub kliknięcie overlay.

---

## 6. Wskaźnik w drzewie plików

- Gdy plik lub katalog należy do co najmniej jednej grupy, wyświetla kwadracik (`7×7px`, `border-radius: 1px`) w kolorze grupy — wyrównany do prawej krawędzi pozycji w drzewie.
- Jeśli należy do kilku grup — wyświetlamy kwadracik pierwszej grupy (wg kolejności dodania). Można rozszerzyć później do stacku kwadracików.
- Kwadracik ma `title` z nazwą grupy (tooltip natywny).

---

## 7. Storage — SQLite via Bun

Bun ma wbudowane SQLite (`bun:sqlite`) — zero nowych zależności npm.

### Schema

```sql
CREATE TABLE groups (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL,
  color TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE group_items (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  path      TEXT NOT NULL,
  added_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(group_id, path)
);
```

Plik bazy danych: `groups.db` w tym samym katalogu co `settings.json` (korzeń repo, obok `apps/`).

### API routes — `GET/POST /api/groups`

| Metoda | Ścieżka | Opis |
|---|---|---|
| GET | `/api/groups` | Lista grup z ich elementami |
| POST | `/api/groups` | Utwórz grupę `{name, color}` |
| PATCH | `/api/groups/:id` | Zmień nazwę / kolor |
| DELETE | `/api/groups/:id` | Usuń grupę (cascade) |
| POST | `/api/groups/:id/items` | Dodaj element `{path}` |
| DELETE | `/api/groups/:id/items/:itemId` | Usuń element z grupy (po `group_items.id`) |

### Odpowiedź GET /api/groups

```json
[
  {
    "id": 1,
    "name": "Projekt Alpha",
    "color": "#c084fc",
    "position": 0,
    "items": [
      { "id": 1, "path": "projekty/alpha", "added_at": 1715000000 },
      { "id": 2, "path": "PRD.md", "added_at": 1715000010 }
    ]
  }
]
```

---

## 8. Frontend — store i komponenty

### Store (`stores/groups.ts` — Pinia)

```ts
interface Group {
  id: number
  name: string
  color: string
  position: number
  items: GroupItem[]
}
interface GroupItem { id: number; path: string; added_at: number }
```

Actions: `fetchGroups`, `createGroup`, `updateGroup`, `deleteGroup`, `addItem`, `removeItem`.

Computed: `groupsByPath` — mapa `path → Group[]` używana przez `TreeItem` do wyświetlania wskaźników.

### Komponenty do stworzenia / zmodyfikowania

| Komponent | Zmiany |
|---|---|
| `Sidebar.vue` | Dodać sekcję Grupy nad drzewem |
| `GroupsSection.vue` | Nowy — lista grup, + button, drop-zone |
| `GroupItem.vue` | Nowy — pojedynczy element grupy w liście |
| `GroupDialog.vue` | Nowy — modal wyboru grupy |
| `ContextMenu.vue` | Nowy — PPM menu (używany przez TreeItem) |
| `TreeItem.vue` | Dodać `draggable`, wskaźnik koloru, obsługę PPM |

---

## 9. Dodatkowe zadania (z sesji design)

- **Motyw „Deep Night"** — nowy theme oparty na palecie z mockupu:
  `bg-main: #0f0f23`, `bg-sidebar: #1a1a2e`, `bg-card: #1e1e38`, `border: #2d2d4e`, `accent: #c084fc`, `text-primary: #e2e8f0`, `text-secondary: #94a3b8`.
  Do dodania w `SettingsPanel.vue` jako wybieralny motyw.

---

## 10. Zakres poza tym sprintem

- Drag & drop do zmiany kolejności grup (sortowanie).
- Kilka kwadracików gdy plik należy do wielu grup.
- Synchronizacja grup między przeglądarkami przez SSE.
- Wyszukiwanie w grupach.
