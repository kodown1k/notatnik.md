<!-- apps/frontend/src/components/GroupItem.vue -->
<template>
  <div class="group-item" :class="{ stale }" @click="onClick">
    <span class="icon">{{ isDir ? '📁' : '📄' }}</span>
    <span v-if="stale" class="stale-icon" title="Plik niedostępny w aktualnym vaultcie">⚠️</span>
    <span class="path">{{ item.path }}</span>
    <button class="remove" @click.stop="$emit('remove')" title="Usuń z grupy">×</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { GroupItem as TGroupItem } from '@notatnik/shared'
import { useVaultStore } from '../stores/vault'

const props = defineProps<{ item: TGroupItem }>()
defineEmits<{ remove: [] }>()

const router = useRouter()
const vaultStore = useVaultStore()

const isDir = computed(() => !props.item.path.endsWith('.md'))

const stale = computed(() => !vaultStore.pathSet.has(props.item.path))

function onClick() {
  if (stale.value) return
  if (!isDir.value) router.push(`/${props.item.path}`)
}
</script>

<style scoped>
.group-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 6px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.78rem;
  color: var(--text-secondary);
  transition: background var(--transition);
}
.group-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.group-item.stale { opacity: 0.5; cursor: not-allowed; }
.icon { flex-shrink: 0; font-size: 0.7rem; }
.stale-icon { flex-shrink: 0; font-size: 0.7rem; }
.path { min-width: 0; word-break: break-word; flex: 1; }
.remove {
  background: none; border: none; color: var(--text-secondary); cursor: pointer;
  padding: 0 4px; font-size: 0.85rem; opacity: 0; transition: opacity var(--transition);
}
.group-item:hover .remove { opacity: 1; }
.remove:hover { color: var(--accent); }
</style>
