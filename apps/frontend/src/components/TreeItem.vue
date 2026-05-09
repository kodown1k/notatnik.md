<!-- apps/frontend/src/components/TreeItem.vue -->
<template>
  <li class="tree-node">
    <!-- Directory -->
    <div
      v-if="node.type === 'dir'"
      class="dir-item"
      draggable="true"
      @click="toggle"
      @dragstart="onDragStart"
      @dragend="onDragEnd"
      @contextmenu.prevent="openContextMenu">
      <span class="dir-arrow">{{ open ? '▾' : '▸' }}</span>
      <span class="dir-name">{{ node.name }}</span>
      <span v-if="groupColorIndicator"
            class="group-indicator"
            :style="{ background: groupColorIndicator.color }"
            :title="groupColorIndicator.name" />
    </div>
    <ul v-if="node.type === 'dir' && open" class="subtree">
      <TreeItem
        v-for="child in node.children ?? []"
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
      draggable="true"
      :class="{ active: currentPath === node.path }"
      @click="$emit('open', node)"
      @dragstart="onDragStart"
      @dragend="onDragEnd"
      @contextmenu.prevent="openContextMenu"
    >
      <span class="file-name">{{ node.name }}</span>
      <span v-if="groupColorIndicator"
            class="group-indicator"
            :style="{ background: groupColorIndicator.color }"
            :title="groupColorIndicator.name" />
      <span
        v-if="changedFiles.has(node.path) && currentPath !== node.path"
        class="change-dot"
        title="Plik zmieniony"
      />
    </div>
  </li>

  <ContextMenu
    :visible="cmVisible"
    :x="cmX"
    :y="cmY"
    :path="node.path"
    @close="cmVisible = false"
    @open="$emit('open', node)"
    @show-dialog="openDialog"
  />

  <GroupDialog v-if="dlgVisible" :path="node.path" @close="dlgVisible = false" />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { TreeNode } from '@notatnik/shared'
import { useGroupsStore } from '../stores/groups'
import ContextMenu from './ContextMenu.vue'
import GroupDialog from './GroupDialog.vue'

defineOptions({ name: 'TreeItem' })

const groupsStore = useGroupsStore()

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

function onDragStart(e: DragEvent) {
  groupsStore.draggingPath = props.node.path
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', props.node.path)
  }
}

function onDragEnd() {
  groupsStore.draggingPath = null
}

const groupColorIndicator = computed(() => {
  const groups = groupsStore.groupsByPath.get(props.node.path)
  if (!groups || groups.length === 0) return null
  return { color: groups[0].color, name: groups[0].name }
})

const cmVisible = ref(false)
const cmX = ref(0)
const cmY = ref(0)
const dlgVisible = ref(false)

function openContextMenu(e: MouseEvent) {
  cmX.value = e.clientX
  cmY.value = e.clientY
  cmVisible.value = true
}

function openDialog() {
  cmVisible.value = false
  dlgVisible.value = true
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
  min-width: 0;
  word-break: break-word;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 16px;
  cursor: pointer;
  transition: background var(--transition);
  color: var(--text-secondary);
  font-size: 0.8rem;
  border-bottom: 1px solid var(--border);
}

.file-item:hover { background: var(--bg-hover); color: var(--text-primary); }

.file-item.active {
  background: var(--bg-hover);
  color: var(--accent);
  font-weight: 600;
  border-right: 2px solid var(--accent);
}

.file-name {
  min-width: 0;
  word-break: break-word;
}

.change-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

.group-indicator {
  width: 8px;
  height: 8px;
  border-radius: 1px;
  flex-shrink: 0;
  margin-left: auto;
}

.file-item .group-indicator + .change-dot,
.dir-item .group-indicator + .change-dot {
  margin-left: 4px;
}
</style>
