<!-- apps/frontend/src/components/MarkdownRenderer.vue -->
<template>
  <div class="md-root">
    <!-- Document-level items (before first ##) -->
    <div v-if="doc.items.length" class="md-items">
      <template v-for="item in doc.items" :key="itemKey(item)">
        <label v-if="item.type === 'task'" class="task-label">
          <input type="checkbox" class="sr-only" :checked="item.checked"
            @change="emit('toggle', item)" />
          <span class="checkbox-visual" :class="{ checked: item.checked }">
            <svg v-if="item.checked" viewBox="0 0 12 10" fill="none">
              <path d="M1 5l3.5 3.5L11 1" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span :class="{ 'task-done': item.checked }" v-html="mdInline(item.text ?? '')" />
        </label>
        <div v-else-if="item.type === 'table'" class="prd-text">
          <table class="prd-table">
            <thead>
              <tr><th v-for="(cell, i) in item.rows![0]" :key="i" v-html="mdInline(cell)" /></tr>
            </thead>
            <tbody>
              <tr v-for="(row, ri) in item.rows!.slice(1)" :key="ri">
                <td v-for="(cell, ci) in row" :key="ci" v-html="mdInline(cell)" />
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="prd-text" v-html="mdInline(item.text ?? '')" />
      </template>
    </div>

    <!-- Chapters -->
    <section v-for="chapter in doc.chapters" :key="chapter.title" class="section-card">
      <div class="section-header">
        <h2>{{ chapter.title }}</h2>
        <ProgressBar :total="chapter.progress.total" :checked="chapter.progress.checked"
          level="chapter" />
      </div>
      <div class="section-body">

        <!-- Chapter-level items -->
        <ItemList :items="chapter.items" :filename="filename" @toggle="(item) => emit('toggle', item)" />

        <!-- Sections -->
        <div v-for="section in chapter.sections" :key="section.title" class="subsection">
          <h3>{{ section.title }}</h3>
          <ProgressBar v-if="section.progress.total > 0"
            :total="section.progress.total" :checked="section.progress.checked"
            level="section" />

          <ItemList :items="section.items" :filename="filename" @toggle="(item) => emit('toggle', item)" />

          <!-- Subsections -->
          <div v-for="sub in section.subsections" :key="sub.title" class="subsubsection">
            <h4>{{ sub.title }}</h4>
            <ProgressBar v-if="sub.progress.total > 0"
              :total="sub.progress.total" :checked="sub.progress.checked"
              level="subsection" />
            <ItemList :items="sub.items" :filename="filename" @toggle="(item) => emit('toggle', item)" />
          </div>
        </div>

      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { mdInline } from '../parser'
import ProgressBar from './ProgressBar.vue'
import type { MdDocument, MdItem } from '@notatnik/shared'

const props = defineProps<{
  doc: MdDocument
  filename: string
}>()

const emit = defineEmits<{ toggle: [item: MdItem] }>()

function itemKey(item: MdItem) {
  return item.hash ?? item.text ?? Math.random()
}
</script>

<style scoped>
.md-root { display: flex; flex-direction: column; gap: 24px; }

.section-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: clip;
}

.section-header {
  position: sticky;
  top: 150px;
  z-index: 10;
  background: rgba(20, 18, 16, 0.85);
  backdrop-filter: blur(16px) saturate(1.3);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-bottom: 1px solid var(--border);
}

[data-theme="light"] .section-header {
  background: rgba(250, 250, 249, 0.9);
}

.section-header h2 {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.section-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }

.subsection { margin-top: 8px; }
.subsection h3 { font-size: 1rem; font-weight: 600; margin-bottom: 6px; color: var(--text-primary); }
.subsubsection { margin-top: 6px; padding-left: 12px; border-left: 2px solid var(--border); }
.subsubsection h4 { font-size: 0.9rem; font-weight: 500; margin-bottom: 4px; color: var(--text-secondary); }

.task-label {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
  padding: 2px 0;
  line-height: 1.5;
}

.task-label:hover .checkbox-visual { border-color: var(--accent); }

.checkbox-visual {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin-top: 3px;
  border: 2px solid var(--neutral-700);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color var(--transition), background var(--transition);
}

.checkbox-visual.checked {
  background: var(--accent);
  border-color: var(--accent);
  color: #000;
}

.checkbox-visual svg { width: 10px; height: 10px; }

.task-done { text-decoration: line-through; opacity: 0.5; }

.prd-text { color: var(--text-secondary); font-size: 0.9rem; }

.prd-text :deep(.prd-table) { width: 100%; border-collapse: collapse; }
.prd-text :deep(.prd-table th) {
  background: var(--bg-elevated);
  font-weight: 600;
  text-align: left;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
}
.prd-text :deep(.prd-table th),
.prd-text :deep(.prd-table td) {
  padding: 7px 12px;
  border: 1px solid var(--neutral-700);
}
</style>
