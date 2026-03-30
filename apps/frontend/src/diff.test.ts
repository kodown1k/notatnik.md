// apps/frontend/src/diff.test.ts
import { describe, test, expect } from 'vitest'
import { computeDiff } from './diff'

describe('computeDiff', () => {
  test('identical texts return empty array', () => {
    expect(computeDiff('hello\nworld', 'hello\nworld')).toEqual([])
  })

  test('empty old text — all lines are adds', () => {
    const result = computeDiff('', 'line1\nline2')
    expect(result.filter(l => l.type === 'add')).toHaveLength(2)
    expect(result.filter(l => l.type === 'remove')).toHaveLength(0)
  })

  test('empty new text — all lines are removes', () => {
    const result = computeDiff('line1\nline2', '')
    expect(result.filter(l => l.type === 'remove')).toHaveLength(2)
    expect(result.filter(l => l.type === 'add')).toHaveLength(0)
  })

  test('added line shows as add', () => {
    const result = computeDiff('line1\nline2', 'line1\nnew line\nline2')
    expect(result.some(l => l.type === 'add' && 'text' in l && l.text === 'new line')).toBe(true)
    expect(result.some(l => l.type === 'remove')).toBe(false)
  })

  test('removed line shows as remove', () => {
    const result = computeDiff('line1\nremoved\nline2', 'line1\nline2')
    expect(result.some(l => l.type === 'remove' && 'text' in l && l.text === 'removed')).toBe(true)
    expect(result.some(l => l.type === 'add')).toBe(false)
  })

  test('changed line shows as remove then add (correct order)', () => {
    const result = computeDiff('line1\nold\nline2', 'line1\nnew\nline2')
    const removeIdx = result.findIndex(l => l.type === 'remove' && 'text' in l && l.text === 'old')
    const addIdx = result.findIndex(l => l.type === 'add' && 'text' in l && l.text === 'new')
    expect(removeIdx).toBeGreaterThanOrEqual(0)
    expect(addIdx).toBeGreaterThan(removeIdx)
  })

  test('context lines appear around changes', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line${i}`)
    const modified = [...lines]
    modified[5] = 'changed'
    const result = computeDiff(lines.join('\n'), modified.join('\n'))
    expect(result.filter(l => l.type === 'context').length).toBeGreaterThan(0)
  })

  test('separator appears between distant hunks', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line${i}`)
    const modified = [...lines]
    modified[0] = 'changed0'
    modified[19] = 'changed19'
    const result = computeDiff(lines.join('\n'), modified.join('\n'))
    expect(result.some(l => l.type === 'sep')).toBe(true)
  })

  test('nearby changes share context, no separator between them', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line${i}`)
    const modified = [...lines]
    modified[4] = 'changedA'
    modified[5] = 'changedB'
    const result = computeDiff(lines.join('\n'), modified.join('\n'))
    expect(result.some(l => l.type === 'sep')).toBe(false)
  })

  test('trailing newline does not produce phantom empty-line diff', () => {
    expect(computeDiff('line1\nline2\n', 'line1\nline2\n')).toEqual([])
  })

  test('returns [] for files exceeding MAX_LINES', () => {
    const bigText = Array.from({ length: 5001 }, (_, i) => `line ${i}`).join('\n')
    const result = computeDiff(bigText, bigText + '\nextra')
    expect(result).toEqual([])
  })
})
