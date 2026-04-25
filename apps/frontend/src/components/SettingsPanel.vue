<!-- apps/frontend/src/components/SettingsPanel.vue -->
<template>
  <div class="settings-backdrop" @click.self="$emit('close')">
    <div class="settings-panel">
      <div class="settings-header">
        <h3>Ustawienia</h3>
        <button class="close-btn" @click="$emit('close')" title="Zamknij">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="settings-body">
        <fieldset class="setting-group">
          <legend>Styl ukończonych zadań</legend>
          <label v-for="opt in checkedOptions" :key="opt.value" class="radio-label">
            <input type="radio" :value="opt.value" v-model="settings.checkedStyle" />
            <span class="radio-visual" />
            <span class="radio-text">
              <span class="radio-title">{{ opt.label }}</span>
              <span class="radio-preview" :class="`preview-${opt.value}`">Przykładowe zadanie</span>
            </span>
          </label>
        </fieldset>

        <fieldset class="setting-group">
          <legend>Szerokość treści</legend>
          <label v-for="opt in widthOptions" :key="opt.value" class="radio-label">
            <input type="radio" :value="opt.value" v-model="settings.contentWidth" />
            <span class="radio-visual" />
            <span class="radio-text">
              <span class="radio-title">{{ opt.label }}</span>
              <span class="radio-desc">{{ opt.desc }}</span>
            </span>
          </label>
        </fieldset>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSettingsStore } from '../stores/settings'

defineEmits<{ close: [] }>()

const settings = useSettingsStore()

const checkedOptions = [
  { value: 'strikethrough' as const, label: 'Przekreślenie' },
  { value: 'dim' as const, label: 'Przygaszenie' },
  { value: 'color' as const, label: 'Zmiana koloru' },
  { value: 'none' as const, label: 'Brak zmian' },
]

const widthOptions = [
  { value: 'narrow' as const, label: 'Wąska', desc: '900px' },
  { value: 'medium' as const, label: 'Średnia', desc: '1200px' },
  { value: 'wide' as const, label: 'Szeroka', desc: '1600px' },
  { value: 'full' as const, label: 'Pełna', desc: '100% ekranu' },
]
</script>

<style scoped>
.settings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.settings-panel {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  width: 380px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.settings-header h3 {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  transition: color var(--transition), background var(--transition);
}

.close-btn:hover { color: var(--text-primary); background: var(--bg-hover); }
.close-btn svg { width: 18px; height: 18px; }

.settings-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.setting-group {
  border: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.setting-group legend {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 10px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius);
  cursor: pointer;
  transition: background var(--transition);
}

.radio-label:hover { background: var(--bg-hover); }

.radio-label input { position: absolute; opacity: 0; pointer-events: none; }

.radio-visual {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border: 2px solid var(--neutral-700);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color var(--transition);
}

.radio-label input:checked ~ .radio-visual {
  border-color: var(--accent);
}

.radio-label input:checked ~ .radio-visual::after {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
}

.radio-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.radio-title {
  font-size: 0.85rem;
  color: var(--text-primary);
  font-weight: 500;
}

.radio-preview {
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.radio-desc {
  font-size: 0.75rem;
  color: var(--text-secondary);
  opacity: 0.7;
}

.preview-strikethrough { text-decoration: line-through; opacity: 0.5; }
.preview-dim { opacity: 0.35; }
.preview-color { color: var(--accent); opacity: 0.7; }
.preview-none { /* normal */ }
</style>
