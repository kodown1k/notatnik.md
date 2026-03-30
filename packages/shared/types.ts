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
  type: 'task' | 'text' | 'table' | 'code'
  text?: string
  checked?: boolean
  hash?: number
  rows?: string[][]
  lang?: string
  code?: string
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
