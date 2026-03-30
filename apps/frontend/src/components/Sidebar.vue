<!-- apps/frontend/src/components/Sidebar.vue -->
<template>
  <nav class="sidebar">
    <ul class="file-list">
      <li v-if="!flatFiles.length" class="no-files">
        Brak plików .md w vaultcie
      </li>
      <li
        v-for="file in flatFiles"
        :key="file.path"
        class="file-item"
        :class="{ active: currentPath === file.path }"
        @click="openFile(file.path)"
      >
        <span class="file-name">{{ file.path }}</span>
        <span
          v-if="vaultStore.changedFiles.has(file.path) && currentPath !== file.path"
          class="change-dot"
          title="Plik zmieniony"
        />
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useVaultStore } from '../stores/vault'
import type { TreeNode } from '@notatnik/shared'

const vaultStore = useVaultStore()
const router = useRouter()
const route = useRoute()

const currentPath = computed(() => {
  const p = route.params.path
  const name = Array.isArray(p) ? p[0] : p ?? ''
  return name.endsWith('.md') ? name : `${name}.md`
})

function flattenTree(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = []
  for (const node of nodes) {
    if (node.type === 'file') result.push(node)
    else if (node.children) result.push(...flattenTree(node.children))
  }
  return result
}

const flatFiles = computed(() => flattenTree(vaultStore.tree))

function openFile(path: string) {
  vaultStore.clearChanged(path)
  router.push(`/${path}`)
}
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-w);
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  overflow-y: auto;
  overflow-x: hidden;
  flex-shrink: 0;
  transition: width 0.2s ease;
}

.sidebar.sidebar-collapsed {
  width: 0;
  border-right: none;
}

.file-list { list-style: none; padding: 8px 0; }

.no-files {
  padding: 12px 16px;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
  transition: background var(--transition);
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.file-item:hover { background: var(--bg-hover); color: var(--text-primary); }

.file-item.active {
  background: var(--bg-hover);
  color: var(--accent);
  font-weight: 600;
  border-right: 2px solid var(--accent);
}

.file-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.change-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}
</style>
