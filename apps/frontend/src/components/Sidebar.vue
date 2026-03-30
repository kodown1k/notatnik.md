<!-- apps/frontend/src/components/Sidebar.vue -->
<template>
  <nav class="sidebar">
    <ul class="tree-root">
      <li v-if="!vaultStore.tree.length" class="no-files">
        Brak plików .md w vaultcie
      </li>
      <TreeItem
        v-for="node in vaultStore.tree"
        :key="node.path"
        :node="node"
        :current-path="currentPath"
        :changed-files="vaultStore.changedFiles"
        @open="openFile"
      />
    </ul>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useVaultStore } from '../stores/vault'
import TreeItem from './TreeItem.vue'
import type { TreeNode } from '@notatnik/shared'

const vaultStore = useVaultStore()
const router = useRouter()
const route = useRoute()

const currentPath = computed(() => {
  const p = route.params.path
  const name = Array.isArray(p) ? p[0] : p ?? ''
  return name.endsWith('.md') ? name : `${name}.md`
})

function openFile(node: TreeNode) {
  router.push(`/${node.path}`)
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

.tree-root { list-style: none; padding: 8px 0; margin: 0; }

.no-files {
  padding: 12px 16px;
  color: var(--text-secondary);
  font-size: 0.85rem;
}
</style>
