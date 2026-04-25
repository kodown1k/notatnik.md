# Design: Diff panel przy zmianie pliku

**Data:** 2026-03-30
**Status:** Zatwierdzony
**Dotyczy:** notatnik.md — powiadomienie o zmianie aktualnie otwartego pliku

---

## Problem

Gdy zewnętrzne narzędzie (edytor, git) zmienia plik aktualnie otwarty w notatnik.md, aplikacja po cichu przeładowuje treść (`loadFile(silent=true)`). Użytkownik nie widzi co się zmieniło.

Dodatkowo: zmiana dot w sidebarze dla plików **nieaktualnie otwartych** jest już zaimplementowana (`changedFiles` reactive Set + `TreeItem` `.change-dot`).

---

## Rozwiązanie

Gdy SSE wykryje `file:changed` dla aktualnie otwartego pliku:
1. Pobierz nowy tekst (nie aktualizuj `doc.value` jeszcze)
2. Oblicz diff linijka-po-linijce względem poprzedniego tekstu
3. Pokaż panel diffa nad treścią
4. Użytkownik klika "Zaakceptuj" → aktualizacja treści, lub "Zamknij" → zachowanie starej treści

---

## Algorytm diff (`apps/frontend/src/diff.ts`)

Nowy plik — implementacja LCS (Longest Common Subsequence) na liniach, bez dodatkowych zależności.

```ts
export type DiffLine =
  | { type: 'add';     text: string }
  | { type: 'remove';  text: string }
  | { type: 'context'; text: string }
  | { type: 'sep' }   // separator "···" dla pominiętego kontekstu

export function computeDiff(oldText: string, newText: string, context = 3): DiffLine[]
```

Algorytm:
1. Podziel oba teksty na linie
2. Oblicz LCS (tablica dp)
3. Wygeneruj tablicę edycji (`add`/`remove`/`equal`)
4. Dodaj `context` linii wokół każdej zmiany (jak `git diff -U3`)
5. Niezmienione bloki poza kontekstem → separator `{ type: 'sep' }`
6. Jeśli brak zmian → zwróć `[]`

---

## Zmiany w FileView (`apps/frontend/src/views/FileView.vue`)

### Nowe refs

```ts
const rawText = ref('')           // bieżący tekst pliku (aktualizowany po każdym loadFile)
const pendingText = ref<string | null>(null)  // nowy tekst czekający na akceptację
const diffLines = ref<DiffLine[]>([])         // obliczony diff do wyświetlenia
```

### Zmiana obsługi SSE

Obecnie `sseStore.setCurrentFile(filename, () => loadFile(true))` — przeładowuje po cichu.

Nowe: zamiast `loadFile(true)` przekazujemy `() => fetchAndDiff()`:

```ts
async function fetchAndDiff() {
  const res = await fetch(`/api/files/${currentFilename.value}`, {
    headers: lastEtag ? { 'If-None-Match': lastEtag } : {},
  })
  if (res.status === 304) return
  if (!res.ok) return

  lastEtag = res.headers.get('ETag') ?? ''
  const newText = await res.text()
  const lines = computeDiff(rawText.value, newText)

  if (lines.length === 0) {
    // Brak zmian w treści (np. tylko metadane) → cichy reload
    doc.value = parse(newText, currentFilename.value)
    rawText.value = newText
    loadProgress()
    return
  }

  pendingText.value = newText
  diffLines.value = lines
}
```

`loadFile` zaktualizowany żeby ustawiał `rawText.value = text` po udanym pobraniu.

### Akcje panelu

```ts
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

---

## UI — panel diffa

Wyświetlany gdy `diffLines.length > 0`, **nad treścią** (poniżej progress bara), sticky.

```
┌──────────────────────────────────────────────────┐
│ ⚡ Plik zaktualizowany         [Zamknij] [Zaakceptuj] │
├──────────────────────────────────────────────────┤
│   wiersz kontekstu                               │
│ - usunięta linia                    (czerwony bg)│
│ + dodana linia                      (zielony bg) │
│   wiersz kontekstu                               │
│ ···                                   (separator)│
└──────────────────────────────────────────────────┘
```

Szczegóły:
- Font: monospace (`var(--font-mono)`)
- Prefix: `+` zielony, `-` czerwony, spacja neutralna
- Max-height: `40vh` z `overflow-y: auto`
- `{ type: 'sep' }` → wiersz `···` z wycentrowanym tekstem, muted color
- "Zamknij" → `dismissDiff()`, treść bez zmian
- "Zaakceptuj" → `acceptDiff()`, treść zaktualizowana

---

## Pliki do modyfikacji

| Plik | Akcja | Co się zmienia |
|------|-------|----------------|
| `apps/frontend/src/diff.ts` | Utwórz | Algorytm LCS diff |
| `apps/frontend/src/views/FileView.vue` | Modyfikuj | `rawText`, `pendingText`, `diffLines`, `fetchAndDiff()`, panel UI |
