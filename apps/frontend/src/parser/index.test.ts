// apps/frontend/src/parser/index.test.ts
import { describe, test, expect } from 'vitest'
import { parse, djb2 } from './index'

describe('djb2 hash', () => {
  test('same string gives same hash', () => {
    expect(djb2('hello')).toBe(djb2('hello'))
  })
  test('different strings give different hash', () => {
    expect(djb2('hello')).not.toBe(djb2('world'))
  })
})

describe('parse: empty / no checkboxes', () => {
  test('empty string produces zero progress', () => {
    const doc = parse('', 'test.md')
    expect(doc.progress).toEqual({ total: 0, checked: 0, pct: 0 })
    expect(doc.chapters).toHaveLength(0)
  })

  test('plain text only — no checkboxes', () => {
    const doc = parse('# Title\n\nSome text here.\n', 'test.md')
    expect(doc.progress.total).toBe(0)
  })
})

describe('parse: document-level checkboxes (no chapters)', () => {
  test('counts checked and unchecked at doc level', () => {
    const md = '- [x] done\n- [ ] todo\n- ✅ also done\n- ⏳ pending\n'
    const doc = parse(md, 'test.md')
    expect(doc.progress.total).toBe(4)
    expect(doc.progress.checked).toBe(2)
    expect(doc.progress.pct).toBe(50)
  })

  test('tasks have correct checked flag', () => {
    const md = '- [x] done\n- [ ] todo\n'
    const doc = parse(md, 'test.md')
    const tasks = doc.items.filter((i) => i.type === 'task')
    expect(tasks[0].checked).toBe(true)
    expect(tasks[1].checked).toBe(false)
  })

  test('tasks have djb2 hash of their text', () => {
    const md = '- [x] my task\n'
    const doc = parse(md, 'test.md')
    const task = doc.items.find((i) => i.type === 'task')!
    expect(task.hash).toBe(djb2('my task'))
  })
})

describe('parse: emoji checkboxes', () => {
  test('✅ is checked', () => {
    const doc = parse('- ✅ done\n', 'test.md')
    expect(doc.items[0].checked).toBe(true)
  })
  test('⏳ is unchecked', () => {
    const doc = parse('- ⏳ pending\n', 'test.md')
    expect(doc.items[0].checked).toBe(false)
  })
  test('❌ is unchecked', () => {
    const doc = parse('- ❌ failed\n', 'test.md')
    expect(doc.items[0].checked).toBe(false)
  })
  test('🔜 is unchecked', () => {
    const doc = parse('- 🔜 soon\n', 'test.md')
    expect(doc.items[0].checked).toBe(false)
  })
})

describe('parse: table rows are NOT checkboxes', () => {
  test('table with checkbox-like content is not parsed as task', () => {
    const md = '| Name | Status |\n|---|---|\n| Task | - [x] done |\n'
    const doc = parse(md, 'test.md')
    expect(doc.progress.total).toBe(0)
    const tables = doc.items.filter((i) => i.type === 'table')
    expect(tables).toHaveLength(1)
  })
})

describe('parse: code blocks are excluded', () => {
  test('checkboxes inside code fences are not counted', () => {
    const md = '```\n- [x] inside code\n```\n- [ ] outside code\n'
    const doc = parse(md, 'test.md')
    expect(doc.progress.total).toBe(1)
    expect(doc.progress.checked).toBe(0)
  })
})

describe('parse: ## chapters', () => {
  test('chapters split document correctly', () => {
    const md = '## Chapter 1\n- [x] a\n## Chapter 2\n- [ ] b\n- [ ] c\n'
    const doc = parse(md, 'test.md')
    expect(doc.chapters).toHaveLength(2)
    expect(doc.chapters[0].title).toBe('Chapter 1')
    expect(doc.chapters[0].progress).toEqual({ total: 1, checked: 1, pct: 100 })
    expect(doc.chapters[1].progress).toEqual({ total: 2, checked: 0, pct: 0 })
  })

  test('document progress is sum of all chapters', () => {
    const md = '## A\n- [x] a\n- [ ] b\n## B\n- [x] c\n'
    const doc = parse(md, 'test.md')
    expect(doc.progress).toEqual({ total: 3, checked: 2, pct: 67 })
  })
})

describe('parse: ### sections', () => {
  test('sections within chapter', () => {
    const md = '## Chapter\n### Section 1\n- [x] a\n- [ ] b\n### Section 2\n- [x] c\n'
    const doc = parse(md, 'test.md')
    const chapter = doc.chapters[0]
    expect(chapter.sections).toHaveLength(2)
    expect(chapter.sections[0].progress).toEqual({ total: 2, checked: 1, pct: 50 })
    expect(chapter.sections[1].progress).toEqual({ total: 1, checked: 1, pct: 100 })
  })
})

describe('parse: #### subsections', () => {
  test('subsections within section', () => {
    const md = '## Ch\n### Sec\n#### Sub A\n- [x] a\n#### Sub B\n- [ ] b\n- [ ] c\n'
    const doc = parse(md, 'test.md')
    const section = doc.chapters[0].sections[0]
    expect(section.subsections).toHaveLength(2)
    expect(section.subsections[0].progress).toEqual({ total: 1, checked: 1, pct: 100 })
    expect(section.subsections[1].progress).toEqual({ total: 2, checked: 0, pct: 0 })
  })
})

describe('parse: title', () => {
  test('uses # heading as title', () => {
    const doc = parse('# My Notes\n', 'file.md')
    expect(doc.title).toBe('My Notes')
  })
  test('falls back to filename if no # heading', () => {
    const doc = parse('## Chapter\n', 'my-file.md')
    expect(doc.title).toBe('my-file.md')
  })
})
