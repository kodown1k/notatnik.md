<!-- apps/frontend/src/components/ContextMenu.vue -->
<template>
  <Teleport to="body">
    <div v-if="visible"
         class="cm-backdrop"
         @click="close"
         @contextmenu.prevent="close">
      <div class="cm" :style="{ left: clampedX + 'px', top: clampedY + 'px' }" @click.stop>
        <button class="cm-item" @click="onOpen">Otwórz</button>
        <div class="cm-sep" />
        <div class="cm-section-label">Dodaj do grupy</div>
        <button v-for="g in groupsStore.recentGroups" :key="g.id"
                class="cm-item cm-group" @click="addTo(g.id)">
          <span class="dot" :style="{ background: g.color }" />
          <span>{{ g.name }}</span>
        </button>
        <div v-if="!groupsStore.recentGroups.length" class="cm-empty">brak ostatnio używanych</div>
        <button class="cm-item cm-link" @click="$emit('show-dialog')">Pokaż wszystkie grupy…</button>
        <template v-if="belongsToAnyGroup">
          <div class="cm-sep" />
          <button class="cm-item cm-danger" @click="removeFromAll">Usuń ze wszystkich grup</button>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch, nextTick, ref } from 'vue'
import { useGroupsStore } from '../stores/groups'

const props = defineProps<{
  visible: boolean
  x: number
  y: number
  path: string
  isFile: boolean
}>()

const emit = defineEmits<{
  close: []
  open: []
  'show-dialog': []
}>()

const groupsStore = useGroupsStore()

const clampedX = ref(props.x)
const clampedY = ref(props.y)

watch(() => [props.visible, props.x, props.y], async () => {
  if (!props.visible) return
  await nextTick()
  const W = 220, H = 240
  clampedX.value = Math.min(props.x, window.innerWidth - W - 8)
  clampedY.value = Math.min(props.y, window.innerHeight - H - 8)
}, { immediate: true })

const belongsToAnyGroup = computed(() => !!groupsStore.groupsByPath.get(props.path)?.length)

function close() { emit('close') }
function onOpen() { emit('open'); emit('close') }

async function addTo(groupId: number) {
  await groupsStore.addItem(groupId, props.path)
  emit('close')
}

async function removeFromAll() {
  await groupsStore.removeFromAllGroups(props.path)
  emit('close')
}
</script>

<style scoped>
.cm-backdrop {
  position: fixed; inset: 0; z-index: 500;
}
.cm {
  position: absolute;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 4px;
  min-width: 200px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  font-size: 0.82rem;
}
.cm-item {
  display: flex; align-items: center; gap: 8px;
  width: 100%; text-align: left;
  background: none; border: none;
  padding: 6px 10px; border-radius: 4px;
  color: var(--text-primary); cursor: pointer;
  font-size: inherit;
}
.cm-item:hover { background: var(--bg-hover); }
.cm-sep { height: 1px; background: var(--border); margin: 3px 0; }
.cm-section-label {
  padding: 4px 10px;
  color: var(--text-secondary);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.cm-group .dot { width: 9px; height: 9px; border-radius: 2px; flex-shrink: 0; }
.cm-link { color: var(--accent); font-size: 0.78rem; }
.cm-danger { color: #ef4444; }
.cm-empty {
  padding: 4px 10px; color: var(--text-secondary); font-size: 0.72rem;
  opacity: 0.6; font-style: italic;
}
</style>
