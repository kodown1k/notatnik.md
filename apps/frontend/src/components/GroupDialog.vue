<!-- apps/frontend/src/components/GroupDialog.vue -->
<template>
  <Teleport to="body">
    <div class="dlg-backdrop" @click.self="$emit('close')" @keydown.escape="$emit('close')">
      <div class="dlg" tabindex="-1" ref="root">
        <h3 class="dlg-title">Wybierz grupę</h3>
        <div class="dlg-subtitle">Dodajesz: <strong>{{ path }}</strong></div>

        <div class="dlg-list">
          <button v-for="g in groupsStore.groups" :key="g.id"
                  class="dlg-row" :class="{ selected: selected.has(g.id) }"
                  @click="toggle(g.id)">
            <span class="dot" :style="{ background: g.color }" />
            <span class="name">{{ g.name }}</span>
            <span v-if="selected.has(g.id)" class="check">✓</span>
          </button>
          <div v-if="!groupsStore.groups.length" class="dlg-empty">Brak grup. Utwórz pierwszą w sidebarze.</div>
        </div>

        <div class="dlg-actions">
          <button class="btn btn-ghost" @click="$emit('close')">Anuluj</button>
          <button class="btn btn-primary" @click="save">Zapisz</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGroupsStore } from '../stores/groups'

const props = defineProps<{ path: string }>()
const emit = defineEmits<{ close: [] }>()

const groupsStore = useGroupsStore()
const root = ref<HTMLDivElement | null>(null)

const initialMembership = new Set<number>(
  (groupsStore.groupsByPath.get(props.path) ?? []).map((g) => g.id)
)
const selected = ref(new Set(initialMembership))

onMounted(() => root.value?.focus())

function toggle(id: number) {
  if (selected.value.has(id)) selected.value.delete(id)
  else selected.value.add(id)
  // Trigger reactivity
  selected.value = new Set(selected.value)
}

async function save() {
  for (const id of selected.value) {
    if (!initialMembership.has(id)) await groupsStore.addItem(id, props.path)
  }
  for (const id of initialMembership) {
    if (!selected.value.has(id)) {
      const group = groupsStore.groups.find((g) => g.id === id)
      const item = group?.items.find((i) => i.path === props.path)
      if (item) await groupsStore.removeItem(id, item.id)
    }
  }
  emit('close')
}
</script>

<style scoped>
.dlg-backdrop {
  position: fixed; inset: 0; z-index: 600;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
}
.dlg {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 18px;
  width: 320px; max-width: 90vw;
  max-height: 70vh; overflow-y: auto;
  box-shadow: 0 12px 40px rgba(0,0,0,0.6);
  outline: none;
}
.dlg-title { font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
.dlg-subtitle { font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 14px; word-break: break-word; }
.dlg-list { display: flex; flex-direction: column; gap: 5px; margin-bottom: 16px; }
.dlg-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 5px;
  cursor: pointer;
  text-align: left;
  font-size: 0.85rem;
  color: var(--text-primary);
}
.dlg-row:hover { background: var(--bg-hover); }
.dlg-row.selected { border-color: var(--accent); background: var(--bg-hover); }
.dlg-row .dot { width: 11px; height: 11px; border-radius: 2px; flex-shrink: 0; }
.dlg-row .name { flex: 1; }
.dlg-row .check { color: var(--accent); font-weight: 700; }
.dlg-empty { padding: 12px; color: var(--text-secondary); font-size: 0.78rem; text-align: center; }
.dlg-actions { display: flex; gap: 8px; justify-content: flex-end; }
.btn {
  padding: 6px 14px; border-radius: 4px; font-size: 0.8rem; cursor: pointer; border: 1px solid transparent;
}
.btn-ghost { background: transparent; border-color: var(--border); color: var(--text-secondary); }
.btn-ghost:hover { color: var(--text-primary); }
.btn-primary { background: var(--accent); color: #fff; font-weight: 600; }
.btn-primary:hover { background: var(--accent-hover); }
</style>
