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

- Implementacja: **natywny HTML5 DnD** (bez dodatkowych zależności). `@vueuse/core` odpada — `useDropZone` jest zoptymalizowany pod dropa plików z OS, nie pod wewnętrzny DnD między elementami drzewa.
- Źródło: `TreeItem` — `draggable="true"` na `.dir-item` i `.file-item`, na `dragstart` ustawiamy reaktywną zmienną `groupsStore.draggingPath = node.path`.
- Cel: każdy nagłówek grupy i placeholder drop-zone nasłuchuje na `dragover` (prevent default) i `drop` — odczytuje `groupsStore.draggingPath`, wywołuje API `POST /api/groups/:id/items`.
- Po upuszczeniu: aktualizacja store, reset `draggingPath = null`.
- Feedback podczas drag: klasa CSS `drag-over` na aktywnej drop-zone (highlight obramowania).

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
- Lista wszystkich grup: każda jako klikalny wiersz z kolorowym kwadracikiem i nazwą. Grupy, do których plik już należy, mają checkmark i są wstępnie zaznaczone. Kliknięcie toggleuje zaznaczenie (dodaj / usuń).
- Przyciski: „Anuluj" (zamknij bez akcji) i „Zapisz" (zatwierdź zmiany i zamknij).
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
```

Kolumna `position` (sortowanie grup drag & drop) jest poza tym sprintem — nie ma jej w schemacie sprint 1. Kolejność wyświetlania: `ORDER BY id ASC`.

Plik bazy danych: `groups.db` w tym samym katalogu co `settings.json` (korzeń repo, obok `apps/`).

**Inicjalizacja:** nowy plik `apps/api/src/db/groups.ts` wykonuje `CREATE TABLE IF NOT EXISTS` przy starcie serwera (importowany w `index.ts` przed montowaniem routes). Bun SQLite automatycznie tworzy plik `.db` przy pierwszym otwarciu. WAL mode: `PRAGMA journal_mode=WAL` — lepsza wydajność przy równoczesnych odczytach SSE.

### API routes — `GET/POST /api/groups`

| Metoda | Ścieżka | Opis |
|---|---|---|
| GET | `/api/groups` | Lista grup z ich elementami |
| POST | `/api/groups` | Utwórz grupę `{name, color}` |
| PATCH | `/api/groups/:id` | Zmień nazwę / kolor |
| DELETE | `/api/groups/:id` | Usuń grupę (cascade) |
| POST | `/api/groups/:id/items` | Dodaj element `{path}` — jeśli istnieje (UNIQUE), zwraca 200 bez błędu (upsert ignoruje duplikat) |
| DELETE | `/api/groups/:id/items/:itemId` | Usuń element z grupy (po `group_items.id`) |
| DELETE | `/api/groups/items/by-path` | Usuń `{path}` ze wszystkich grup jednym zapytaniem (`DELETE FROM group_items WHERE path = ?`) |

### Odpowiedź GET /api/groups

Zwraca `[]` gdy vault nie jest skonfigurowany (brak błędu — grupy są globalne, niezależne od vaultu).

```json
[
  {
    "id": 1,
    "name": "Projekt Alpha",
    "color": "#c084fc",
    "items": [
      { "id": 1, "path": "projekty/alpha", "added_at": 1715000000 },
      { "id": 2, "path": "PRD.md", "added_at": 1715000010 }
    ]
  }
]
```

### Grupy a zmiana vaultu

Grupy są **globalne** — nie powiązane z konkretnym vaultem. `path` w `group_items` to ścieżka względem aktualnego vaultu. Po zmianie vaultu elementy, których ścieżek nie ma w nowym drzewie, są wyświetlane w kolorze muted z ikoną ⚠️ i nie są klikalne. Użytkownik może je ręcznie usunąć z grupy. Baza danych nie jest czyszczona automatycznie przy zmianie vaultu.

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
| `ContextMenu.vue` | Nowy — PPM menu renderowany przez `<Teleport to="body">` wewnątrz `TreeItem`, pozycjonowany absolutnie przy kursorze. Eliminuje potrzebę bąbelkowania `contextmenu` przez zagnieżdżone drzewo. |
| `TreeItem.vue` | Dodać `draggable="true"` + `@dragstart`, wskaźnik koloru (kwadracik), `@contextmenu.prevent` montujący `ContextMenu` |

---

## 9. Dodatkowe zadania (z sesji design)

- **Motyw „Deep Night"** — nowy theme oparty na palecie z mockupu:
  `bg-main: #0f0f23`, `bg-sidebar: #1a1a2e`, `bg-card: #1e1e38`, `border: #2d2d4e`, `accent: #c084fc`, `text-primary: #e2e8f0`, `text-secondary: #94a3b8`.
  Do dodania w `SettingsPanel.vue` jako wybieralny motyw.

---

## 10. Zakres poza tym sprintem

- Drag & drop do zmiany kolejności grup (sortowanie) — kolumna `position` w tabeli `groups`.
- Kilka kwadracików gdy plik należy do wielu grup.
- Synchronizacja grup między przeglądarkami przez SSE.
- Wyszukiwanie w grupach.
- Grupy per-vault (kolumna `vault_path` w tabeli `groups`).
