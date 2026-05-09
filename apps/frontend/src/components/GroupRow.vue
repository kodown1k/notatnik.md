<!-- apps/frontend/src/components/GroupRow.vue -->
<template>
  <div class="group-row" :class="{ 'drag-over': isDragOver }"
       @dragover.prevent="onDragOver"
       @dragleave="isDragOver = false"
       @drop.prevent="onDrop">
    <div class="group-header" @click="toggle">
      <span class="arrow">{{ open ? '▾' : '▸' }}</span>
      <span class="color-square" :style="{ background: group.color }" />
      <span class="name">{{ group.name }}</span>
      <button class="remove" @click.stop="confirmDelete" title="Usuń grupę">×</button>
    </div>
    <div v-if="open" class="items">
      <GroupItem
        v-for="item in group.items"
        :key="item.id"
        :item="item"
        @remove="removeItem(item.id)"
      />
      <div v-if="!group.items.length" class="empty">brak elementów</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Group } from '@notatnik/shared'
import { useGroupsStore } from '../stores/groups'
import GroupItem from './GroupItem.vue'

const props = defineProps<{ group: Group }>()
const groupsStore = useGroupsStore()

const STORAGE_KEY = `notatnik-group-open:${props.group.id}`
const open = ref(localStorage.getItem(STORAGE_KEY) !== 'closed')
const isDragOver = ref(false)

function toggle() {
  open.value = !open.value
  localStorage.setItem(STORAGE_KEY, open.value ? 'open' : 'closed')
}

async function confirmDelete() {
  if (!confirm(`Usunąć grupę "${props.group.name}"? (Pliki na dysku NIE zostaną usunięte.)`)) return
  await groupsStore.deleteGroup(props.group.id)
}

async function removeItem(itemId: number) {
  await groupsStore.removeItem(props.group.id, itemId)
}

function onDragOver() {
  if (groupsStore.draggingPath) isDragOver.value = true
}

async function onDrop() {
  isDragOver.value = false
  const path = groupsStore.draggingPath
  if (!path) return
  groupsStore.draggingPath = null
  await groupsStore.addItem(props.group.id, path)
  if (!open.value) toggle()
}
</script>

<style scoped>
.group-row { border-bottom: 1px solid var(--border); transition: background var(--transition); }
.group-row.drag-over { background: var(--bg-hover); box-shadow: inset 0 0 0 2px var(--accent); }

.group-header {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; cursor: pointer; font-size: 0.82rem;
  color: var(--text-primary); font-weight: 500;
}
.group-header:hover { background: var(--bg-hover); }

.arrow { font-size: 0.7rem; width: 10px; flex-shrink: 0; color: var(--text-secondary); }
.color-square { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
.name { flex: 1; min-width: 0; word-break: break-word; }
.remove {
  background: none; border: none; color: var(--text-secondary); cursor: pointer;
  padding: 0 4px; font-size: 0.95rem; opacity: 0; transition: opacity var(--transition);
}
.group-header:hover .remove { opacity: 1; }
.remove:hover { color: var(--accent); }

.items { padding: 0 8px 6px 24px; }
.empty { padding: 4px 6px; color: var(--text-secondary); font-size: 0.72rem; opacity: 0.6; font-style: italic; }
</style>
