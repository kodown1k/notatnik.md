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
  readonly?: boolean  // true when vault is set via VAULT_PATH env var
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
  type: 'task' | 'text' | 'table' | 'code' | 'blockquote' | 'hr' | 'anchor'
  text?: string
  checked?: boolean
  hash?: number
  rows?: string[][]
  lang?: string
  code?: string
  lines?: string[]  // blockquote lines
  id?: string       // anchor id (for type='anchor')
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
