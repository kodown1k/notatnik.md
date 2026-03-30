<!-- apps/frontend/src/components/TreeItem.vue -->
<template>
  <li class="tree-node">
    <!-- Directory -->
    <div v-if="node.type === 'dir'" class="dir-item" @click="toggle">
      <span class="dir-arrow">{{ open ? '▾' : '▸' }}</span>
      <span class="dir-name">{{ node.name }}</span>
    </div>
    <ul v-if="node.type === 'dir' && open" class="subtree">
      <TreeItem
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :current-path="currentPath"
        :changed-files="changedFiles"
        @open="$emit('open', $event)"
      />
    </ul>

    <!-- File -->
    <div
      v-else-if="node.type === 'file'"
      class="file-item"
      :class="{ active: currentPath === node.path }"
      @click="$emit('open', node)"
    >
      <span class="file-name">{{ node.name }}</span>
      <span
        v-if="changedFiles.has(node.path) && currentPath !== node.path"
        class="change-dot"
        title="Plik zmieniony"
      />
    </div>
  </li>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { TreeNode } from '@notatnik/shared'

defineOptions({ name: 'TreeItem' })

const props = defineProps<{
  node: TreeNode
  currentPath: string
  changedFiles: Set<string>
}>()

defineEmits<{
  open: [node: TreeNode]
}>()

const STORAGE_KEY = `notatnik-tree-open:${props.node.path}`
const open = ref(
  props.node.type === 'dir'
    ? (localStorage.getItem(STORAGE_KEY) ?? 'open') !== 'closed'
    : false
)

function toggle() {
  open.value = !open.value
  localStorage.setItem(STORAGE_KEY, open.value ? 'open' : 'closed')
}
</script>

<style scoped>
.tree-node { list-style: none; }

.subtree { list-style: none; padding: 0; margin: 0; padding-left: 14px; }

.dir-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 16px;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 0.85rem;
  font-weight: 600;
  transition: background var(--transition);
}

.dir-item:hover { background: var(--bg-hover); }

.dir-arrow {
  font-size: 0.75rem;
  width: 12px;
  flex-shrink: 0;
  color: var(--text-secondary);
}

.dir-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 16px;
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
