// apps/frontend/src/diff.ts

export type DiffLine =
  | { type: 'add'; text: string }
  | { type: 'remove'; text: string }
  | { type: 'context'; text: string }
  | { type: 'sep' }

export function computeDiff(oldText: string, newText: string, context = 3): DiffLine[] {
  const oldLines = oldText === '' ? [] : oldText.split('\n')
  const newLines = newText === '' ? [] : newText.split('\n')

  const m = oldLines.length
  const n = newLines.length

  // Build LCS dp table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  // Backtrack to produce edit list
  type Edit = { type: 'add' | 'remove' | 'equal'; text: string }
  const edits: Edit[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      edits.unshift({ type: 'equal', text: oldLines[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      edits.unshift({ type: 'add', text: newLines[j - 1] })
      j--
    } else {
      edits.unshift({ type: 'remove', text: oldLines[i - 1] })
      i--
    }
  }

  // No changes?
  if (edits.every(e => e.type === 'equal')) return []

  // Determine which edit indices to include (changed ± context lines)
  const include = new Set<number>()
  for (let idx = 0; idx < edits.length; idx++) {
    if (edits[idx].type !== 'equal') {
      for (let c = Math.max(0, idx - context); c <= Math.min(edits.length - 1, idx + context); c++) {
        include.add(c)
      }
    }
  }

  // Build output, inserting separators for skipped ranges
  const result: DiffLine[] = []
  let lastIncluded = -1

  for (let idx = 0; idx < edits.length; idx++) {
    if (!include.has(idx)) continue
    if (lastIncluded !== -1 && idx > lastIncluded + 1) {
      result.push({ type: 'sep' })
    }
    const e = edits[idx]
    if (e.type === 'equal') {
      result.push({ type: 'context', text: e.text })
    } else {
      result.push({ type: e.type, text: e.text })
    }
    lastIncluded = idx
  }

  return result
}
