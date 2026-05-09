// apps/frontend/src/stores/vault.ts
import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'
import type { TreeNode } from '@notatnik/shared'

export const useVaultStore = defineStore('vault', () => {
  const vaultPath = ref('')
  const vaultReadonly = ref(false)
  const tree = ref<TreeNode[]>([])
  const changedFiles = reactive(new Set<string>())  // relative paths with unseen changes
  const fileSnapshots = new Map<string, string>()   // last known content per file (for diff-on-navigate)

  const pathSet = computed(() => {
    const s = new Set<string>()
    function walk(nodes: TreeNode[]) {
      for (const n of nodes) {
        s.add(n.path)
        if (n.children) walk(n.children)
      }
    }
    walk(tree.value)
    return s
  })

  // Tree expand/collapse state — reactive, source of truth for TreeItem.
  // Default behaviour: directory is open unless explicitly closed.
  const TREE_OPEN_PREFIX = 'notatnik-tree-open:'
  const treeOpenState = reactive(new Map<string, boolean>())
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(TREE_OPEN_PREFIX)) {
      treeOpenState.set(key.slice(TREE_OPEN_PREFIX.length), localStorage.getItem(key) === 'open')
    }
  }
  function isTreeOpen(path: string): boolean {
    return treeOpenState.has(path) ? treeOpenState.get(path)! : true
  }
  function setTreeOpen(path: string, open: boolean) {
    treeOpenState.set(path, open)
    localStorage.setItem(`${TREE_OPEN_PREFIX}${path}`, open ? 'open' : 'closed')
  }
  function revealInTree(path: string) {
    const parts = path.split('/').filter(Boolean)
    for (let i = 1; i <= parts.length; i++) {
      setTreeOpen(parts.slice(0, i).join('/'), true)
    }
  }

  const HISTORY_KEY = 'notatnik-vault-history'
  const MAX_HISTORY = 5

  function getHistory(): string[] {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') }
    catch { return [] }
  }

  function addToHistory(path: string) {
    const history = [path, ...getHistory().filter((p) => p !== path)].slice(0, MAX_HISTORY)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  }

  async function setVault(path: string) {
    const res = await fetch('/api/vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Failed to set vault')
    }
    vaultPath.value = path
    addToHistory(path)
    await refreshFiles()
  }

  async function loadVault() {
    const res = await fetch('/api/vault')
    const data = await res.json()
    vaultPath.value = data.path ?? ''
    vaultReadonly.value = !!data.readonly
    if (vaultPath.value) await refreshFiles()
  }

  async function refreshFiles() {
    const res = await fetch('/api/files')
    tree.value = await res.json()
  }

  function firstFile(nodes: TreeNode[] = tree.value): TreeNode | null {
    for (const node of nodes) {
      if (node.type === 'file') return node
      if (node.children) {
        const found = firstFile(node.children)
        if (found) return found
      }
    }
    return null
  }

  function firstFileInDir(dirPath: string): TreeNode | null {
    function findDir(nodes: TreeNode[]): TreeNode | null {
      for (const n of nodes) {
        if (n.type === 'dir' && n.path === dirPath) return n
        if (n.children) {
          const found = findDir(n.children)
          if (found) return found
        }
      }
      return null
    }
    const dir = findDir(tree.value)
    return dir?.children ? firstFile(dir.children) : null
  }

  function markChanged(filename: string) {
    changedFiles.add(filename)
  }

  function clearChanged(filename: string) {
    changedFiles.delete(filename)
  }

  function saveSnapshot(filename: string, text: string) {
    fileSnapshots.set(filename, text)
  }

  function getSnapshot(filename: string): string | null {
    return fileSnapshots.get(filename) ?? null
  }

  return {
    vaultPath,
    vaultReadonly,
    tree,
    changedFiles,
    pathSet,
    isTreeOpen,
    setTreeOpen,
    revealInTree,
    getHistory,
    setVault,
    loadVault,
    refreshFiles,
    firstFile,
    firstFileInDir,
    markChanged,
    clearChanged,
    saveSnapshot,
    getSnapshot,
  }
})
