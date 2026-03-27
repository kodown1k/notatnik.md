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

    <!-- Chapters (##) -->
    <section v-for="chapter in doc.chapters" :key="chapter.title" class="section-card">
      <!-- Sticky chapter header — padding-top covers inter-card gap with blur -->
      <div class="section-header">
        <h2>{{ chapter.title }}</h2>
        <ProgressBar :total="chapter.progress.total" :checked="chapter.progress.checked"
          level="chapter" />
      </div>

      <div class="section-body">
        <!-- Chapter-level items (before first ###) -->
        <ItemList :items="chapter.items" :filename="filename" @toggle="(item) => emit('toggle', item)" />

        <!-- Sections (###) -->
        <div v-for="section in chapter.sections" :key="section.title" class="subsection">

          <!-- Sticky section header -->
          <div class="subsection-header">
            <h3>{{ section.title }}</h3>
            <ProgressBar v-if="section.progress.total > 0"
              :total="section.progress.total" :checked="section.progress.checked"
              level="section" />
          </div>

          <div class="subsection-body">
            <ItemList :items="section.items" :filename="filename" @toggle="(item) => emit('toggle', item)" />

            <!-- Subsections (####) -->
            <div v-for="sub in section.subsections" :key="sub.title" class="subsubsection">

              <!-- Sticky subsection header -->
              <div class="subsubsection-header">
                <h4>{{ sub.title }}</h4>
                <ProgressBar v-if="sub.progress.total > 0"
                  :total="sub.progress.total" :checked="sub.progress.checked"
                  level="subsection" />
              </div>

              <div class="subsubsection-body">
                <ItemList :items="sub.items" :filename="filename" @toggle="(item) => emit('toggle', item)" />
              </div>

            </div>
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
/* ── Layout ─────────────────────────────────── */

/* No gap between cards — gap lives inside each header's padding-top (blurred) */
.md-root { display: flex; flex-direction: column; gap: 0; }

.section-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: clip;        /* clip (not hidden) — sticky children still work */
  margin-bottom: 2px;    /* thin separator so borders don't double up */
}

/* ── Sticky levels ──────────────────────────── */
/*
  Stack (relative to .main-content scroll container, which starts below the navbar):
    doc-progress  : top: 0         h ≈ 54px
    section (##)  : top: 54px      h ≈ 80px
    subsection (###) : top: 134px  h ≈ 54px
    subsubsection (####): top: 188px
*/

/* ## — chapter header */
.section-header {
  position: sticky;
  top: 54px;          /* right below doc-progress */
  z-index: 10;
  /* padding-top includes the inter-card gap → covered by blur */
  padding: 20px 16px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: rgba(16, 15, 13, 0.88);
  backdrop-filter: blur(20px) saturate(1.4);
  border-bottom: 1px solid var(--border);
}

[data-theme="light"] .section-header {
  background: rgba(250, 249, 248, 0.92);
}

.section-header h2 {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

/* ### — section header */
.subsection-header {
  position: sticky;
  top: 134px;         /* doc 54 + chapter 80 */
  z-index: 9;
  padding: 14px 0 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  background: rgba(18, 17, 15, 0.82);
  backdrop-filter: blur(16px) saturate(1.3);
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

[data-theme="light"] .subsection-header {
  background: rgba(248, 247, 245, 0.88);
  border-bottom-color: rgba(0,0,0,0.06);
}

.subsection-header h3 {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
}

/* #### — subsection header */
.subsubsection-header {
  position: sticky;
  top: 188px;         /* doc 54 + chapter 80 + section 54 */
  z-index: 8;
  padding: 10px 12px 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: rgba(20, 18, 16, 0.75);
  backdrop-filter: blur(12px) saturate(1.2);
  border-left: 2px solid var(--accent);
  border-bottom: 1px solid rgba(255,255,255,0.04);
  margin-left: 0;
}

[data-theme="light"] .subsubsection-header {
  background: rgba(246, 244, 242, 0.85);
  border-bottom-color: rgba(0,0,0,0.05);
}

.subsubsection-header h4 {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
}

/* ── Content areas ──────────────────────────── */

.section-body {
  padding: 14px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.subsection {
  margin-top: 0;
}

.subsection-body {
  padding: 8px 0 12px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.subsubsection {
  margin-top: 0;
}

.subsubsection-body {
  padding: 6px 12px 8px;
}

/* ── Tasks ──────────────────────────────────── */

.task-label {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
  padding: 3px 0;
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

/* ── Text / Tables ──────────────────────────── */

.prd-text { color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6; }

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
