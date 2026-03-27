<!-- apps/frontend/src/components/Sidebar.vue -->
<template>
  <nav class="sidebar">
    <ul class="file-list">
      <li v-if="!vaultStore.files.length" class="no-files">
        Brak plików .md w vaultcie
      </li>
      <li
        v-for="file in vaultStore.files"
        :key="file.filename"
        class="file-item"
        :class="{ active: currentFilename === file.filename }"
        @click="openFile(file.filename)"
      >
        <span class="file-name">{{ file.name }}</span>
        <span
          v-if="vaultStore.changedFiles.has(file.filename) && currentFilename !== file.filename"
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

const vaultStore = useVaultStore()
const router = useRouter()
const route = useRoute()

const currentFilename = computed(() => {
  const p = route.params.filename
  const name = Array.isArray(p) ? p[0] : p ?? ''
  return name.endsWith('.md') ? name : `${name}.md`
})

function openFile(filename: string) {
  vaultStore.clearChanged(filename)
  router.push(`/${filename}`)
}
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-w);
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  height: calc(100vh - var(--navbar-h));
  position: sticky;
  top: var(--navbar-h);
  overflow-y: auto;
  flex-shrink: 0;
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
