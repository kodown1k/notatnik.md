<!-- apps/frontend/src/components/GroupsSection.vue -->
<template>
  <section class="groups-section">
    <header class="section-header">
      <span class="label">Grupy</span>
      <button class="add-btn" @click="startCreate" title="Nowa grupa">+</button>
    </header>

    <div v-if="creating" class="create-form">
      <div class="palette">
        <button v-for="c in colors" :key="c"
                class="swatch" :class="{ selected: selectedColor === c }"
                :style="{ background: c }"
                @click="selectedColor = c"
                :title="c" />
      </div>
      <input ref="nameInput"
             v-model="newName"
             class="name-input"
             placeholder="Nazwa grupy…"
             @keydown.enter="commitCreate"
             @keydown.escape="cancelCreate"
             @blur="commitCreate" />
    </div>

    <div class="groups-list">
      <GroupRow v-for="g in groupsStore.groups" :key="g.id" :group="g" />
      <div v-if="!groupsStore.groups.length && !creating" class="empty">
        Brak grup. Kliknij <strong>+</strong> żeby utworzyć pierwszą.
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { GROUP_COLORS } from '@notatnik/shared'
import { useGroupsStore } from '../stores/groups'
import GroupRow from './GroupRow.vue'

const groupsStore = useGroupsStore()
const colors = GROUP_COLORS
const creating = ref(false)
const newName = ref('')
const selectedColor = ref<string>(colors[0])
const nameInput = ref<HTMLInputElement | null>(null)
let suppressBlurCommit = false

async function startCreate() {
  creating.value = true
  newName.value = ''
  selectedColor.value = colors[0]
  await nextTick()
  nameInput.value?.focus()
}

async function commitCreate() {
  if (suppressBlurCommit) return
  suppressBlurCommit = true
  const name = newName.value.trim()
  if (!name) {
    creating.value = false
    suppressBlurCommit = false
    return
  }
  await groupsStore.createGroup(name, selectedColor.value)
  creating.value = false
  setTimeout(() => { suppressBlurCommit = false }, 0)
}

function cancelCreate() {
  suppressBlurCommit = true
  creating.value = false
  setTimeout(() => { suppressBlurCommit = false }, 0)
}
</script>

<style scoped>
.groups-section { border-bottom: 1px solid var(--border); }

.section-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 12px; border-bottom: 1px solid var(--border);
}
.label { font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; }
.add-btn {
  background: none; border: none; color: var(--text-secondary); cursor: pointer;
  font-size: 1.1rem; line-height: 1; padding: 0 4px;
}
.add-btn:hover { color: var(--accent); }

.create-form { padding: 6px 10px; background: var(--bg-hover); border-bottom: 1px solid var(--border); }
.palette { display: flex; gap: 4px; margin-bottom: 5px; }
.swatch {
  width: 14px; height: 14px; border-radius: 3px; border: 1px solid transparent; cursor: pointer; padding: 0;
}
.swatch.selected { border-color: var(--text-primary); transform: scale(1.15); }
.name-input {
  width: 100%;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--accent);
  color: var(--text-primary);
  font-size: 0.78rem;
  outline: none;
  padding: 2px 0;
}

.groups-list { padding: 2px 0; }
.empty {
  padding: 8px 12px; color: var(--text-secondary); font-size: 0.72rem; opacity: 0.6; line-height: 1.5;
}
</style>
