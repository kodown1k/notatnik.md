// apps/frontend/src/stores/vault.ts
import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import type { TreeNode } from '@notatnik/shared'

export const useVaultStore = defineStore('vault', () => {
  const vaultPath = ref('')
  const tree = ref<TreeNode[]>([])
  const changedFiles = reactive(new Set<string>())  // relative paths with unseen changes

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

  function markChanged(filename: string) {
    changedFiles.add(filename)
  }

  function clearChanged(filename: string) {
    changedFiles.delete(filename)
  }

  return {
    vaultPath,
    tree,
    changedFiles,
    getHistory,
    setVault,
    loadVault,
    refreshFiles,
    firstFile,
    markChanged,
    clearChanged,
  }
})
