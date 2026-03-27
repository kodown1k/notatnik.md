<template>
  <div class="progress-wrap" :class="`level-${level}`">
    <div class="progress-header">
      <span v-if="label" class="progress-label">{{ label }}</span>
      <span class="progress-stats">{{ pct }}% ({{ checked }}/{{ total }})</span>
    </div>
    <div class="progress-track">
      <div class="progress-fill" :style="{ width: `${pct}%` }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  total: number
  checked: number
  label?: string
  level?: 'doc' | 'chapter' | 'section' | 'subsection'
}>()

const pct = computed(() =>
  props.total === 0 ? 0 : Math.round((props.checked / props.total) * 100)
)
</script>

<style scoped>
.progress-wrap { display: flex; flex-direction: column; gap: 4px; }

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.progress-label {
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.progress-stats {
  font-size: 0.8em;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.progress-track {
  height: 6px;
  background: var(--progress-bg);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--progress-fill);
  border-radius: 3px;
  transition: width 0.3s ease;
  min-width: 0;
}

/* Smaller bars for deeper levels */
.level-section .progress-track  { height: 4px; }
.level-subsection .progress-track { height: 3px; }

.level-section .progress-label  { font-size: 0.9em; font-weight: 500; }
.level-subsection .progress-label { font-size: 0.85em; font-weight: 400; }
</style>
