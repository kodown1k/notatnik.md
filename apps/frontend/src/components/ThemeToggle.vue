<!-- apps/frontend/src/components/ThemeToggle.vue -->
<template>
  <button class="theme-toggle" @click="toggle" :title="`Przełącz na ${isDark ? 'jasny' : 'ciemny'} motyw`">
    <svg v-if="isDark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <!-- Sun icon -->
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <!-- Moon icon -->
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '../stores/settings'

const settings = useSettingsStore()
const isDark = computed(() => settings.theme !== 'light')

function toggle() {
  settings.theme = settings.theme === 'light' ? 'dark' : 'light'
}
</script>

<style scoped>
.theme-toggle {
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color var(--transition), border-color var(--transition);
}

.theme-toggle:hover { color: var(--accent); border-color: var(--accent); }
.theme-toggle svg { width: 18px; height: 18px; }
</style>
