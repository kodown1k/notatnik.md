// apps/frontend/src/parser/index.ts
import type { MdDocument, MdChapter, MdSection, MdSubsection, MdItem, Progress } from '@notatnik/shared'

export function djb2(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return h >>> 0  // unsigned
}

function makeProgress(items: MdItem[], ...children: Progress[]): Progress {
  const childTotal = children.reduce((s, p) => s + p.total, 0)
  const childChecked = children.reduce((s, p) => s + p.checked, 0)
  const localTasks = items.filter((i) => i.type === 'task')
  const total = localTasks.length + childTotal
  const checked = localTasks.filter((i) => i.checked).length + childChecked
  const pct = total === 0 ? 0 : Math.round((checked / total) * 100)
  return { total, checked, pct }
}

function parseItem(line: string): MdItem | null {
  // Checked: - [x], - ✅
  if (/^- \[x\] /i.test(line)) {
    const text = line.replace(/^- \[x\] /i, '').trim()
    return { type: 'task', text, checked: true, hash: djb2(text) }
  }
  if (/^- ✅ /.test(line)) {
    const text = line.replace(/^- ✅ /, '').trim()
    return { type: 'task', text, checked: true, hash: djb2(text) }
  }
  // Unchecked: - [ ], - ⏳, - ❌, - 🔜
  if (/^- \[ \] /.test(line)) {
    const text = line.replace(/^- \[ \] /, '').trim()
    return { type: 'task', text, checked: false, hash: djb2(text) }
  }
  if (/^- (⏳|❌|🔜) /.test(line)) {
    const text = line.replace(/^- (⏳|❌|🔜) /, '').trim()
    return { type: 'task', text, checked: false, hash: djb2(text) }
  }
  return null
}

export function parse(markdown: string, filename: string): MdDocument {
  const lines = markdown.split('\n')
  let title = filename

  type RawNode =
    | { kind: 'h1'; text: string }
    | { kind: 'h2'; text: string }
    | { kind: 'h3'; text: string }
    | { kind: 'h4'; text: string }
    | { kind: 'item'; item: MdItem }
    | { kind: 'table'; rows: string[][] }
    | { kind: 'text'; text: string }

  const nodes: RawNode[] = []
  let inCode = false
  let tableBuffer: string[] = []

  function flushTable() {
    if (tableBuffer.length === 0) return
    const rows = tableBuffer
      .filter((l) => !/^\|[\s\-:|]+\|$/.test(l.trim()))
      .map((l) =>
        l.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim())
      )
    if (rows.length > 0) nodes.push({ kind: 'table', rows })
    tableBuffer = []
  }

  for (const line of lines) {
    if (line.startsWith('```')) {
      flushTable()
      inCode = !inCode
      nodes.push({ kind: 'text', text: line })
      continue
    }
    if (inCode) {
      nodes.push({ kind: 'text', text: line })
      continue
    }

    if (line.startsWith('|')) {
      tableBuffer.push(line)
      continue
    } else {
      flushTable()
    }

    if (/^# /.test(line)) {
      title = line.replace(/^# /, '').trim()
      nodes.push({ kind: 'h1', text: title })
      continue
    }
    if (/^## /.test(line)) {
      nodes.push({ kind: 'h2', text: line.replace(/^## /, '').trim() })
      continue
    }
    if (/^### /.test(line)) {
      nodes.push({ kind: 'h3', text: line.replace(/^### /, '').trim() })
      continue
    }
    if (/^#### /.test(line)) {
      nodes.push({ kind: 'h4', text: line.replace(/^#### /, '').trim() })
      continue
    }

    const item = parseItem(line)
    if (item) {
      nodes.push({ kind: 'item', item })
    } else {
      nodes.push({ kind: 'text', text: line })
    }
  }
  flushTable()

  // Phase 2: build AST from nodes
  const docItems: MdItem[] = []
  const chapters: MdChapter[] = []
  let curChapter: MdChapter | null = null
  let curSection: MdSection | null = null
  let curSubsection: MdSubsection | null = null

  function pushItem(item: MdItem) {
    if (curSubsection) curSubsection.items.push(item)
    else if (curSection) curSection.items.push(item)
    else if (curChapter) curChapter.items.push(item)
    else docItems.push(item)
  }

  for (const node of nodes) {
    if (node.kind === 'h2') {
      curSubsection = null
      curSection = null
      curChapter = {
        title: node.text,
        progress: { total: 0, checked: 0, pct: 0 },
        sections: [],
        items: [],
      }
      chapters.push(curChapter)
    } else if (node.kind === 'h3') {
      curSubsection = null
      curSection = {
        title: node.text,
        progress: { total: 0, checked: 0, pct: 0 },
        subsections: [],
        items: [],
      }
      if (curChapter) curChapter.sections.push(curSection)
    } else if (node.kind === 'h4') {
      curSubsection = {
        title: node.text,
        progress: { total: 0, checked: 0, pct: 0 },
        items: [],
      }
      if (curSection) curSection.subsections.push(curSubsection)
    } else if (node.kind === 'item') {
      pushItem(node.item)
    } else if (node.kind === 'table') {
      pushItem({ type: 'table', rows: node.rows })
    } else if (node.kind === 'text') {
      pushItem({ type: 'text', text: node.text })
    }
    // h1 already handled (title)
  }

  // Phase 3: compute progress bottom-up
  for (const ch of chapters) {
    for (const sec of ch.sections) {
      for (const sub of sec.subsections) {
        sub.progress = makeProgress(sub.items)
      }
      sec.progress = makeProgress(sec.items, ...sec.subsections.map((s) => s.progress))
    }
    ch.progress = makeProgress(ch.items, ...ch.sections.map((s) => s.progress))
  }

  const docProgress = makeProgress(docItems, ...chapters.map((ch) => ch.progress))

  return { title, progress: docProgress, chapters, items: docItems }
}

export function mdInline(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
}
