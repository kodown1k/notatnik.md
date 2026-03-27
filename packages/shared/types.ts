// packages/shared/types.ts

export interface FileInfo {
  name: string      // without .md extension, for display
  filename: string  // with .md extension, used in API paths
  mtime: number     // ms timestamp
  size: number      // bytes
}

export interface VaultConfig {
  path: string
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
  type: 'task' | 'text' | 'table' | 'code'
  text?: string       // raw text for type=text|task
  checked?: boolean   // only for type=task
  hash?: number       // djb2 hash of text, for localStorage keying
  rows?: string[][]   // only for type=table: [row][col]
}

export interface MdSubsection {
  title: string       // #### heading text
  progress: Progress
  items: MdItem[]
}

export interface MdSection {
  title: string       // ### heading text
  progress: Progress
  subsections: MdSubsection[]
  items: MdItem[]     // items before first #### subsection
}

export interface MdChapter {
  title: string       // ## heading text
  progress: Progress
  sections: MdSection[]
  items: MdItem[]     // items before first ### section
}

export interface MdDocument {
  title: string       // # heading text, or filename if missing
  progress: Progress
  chapters: MdChapter[]
  items: MdItem[]     // items before first ## chapter
}
