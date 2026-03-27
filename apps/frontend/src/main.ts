// apps/frontend/src/main.ts
import { createApp, defineComponent, h } from 'vue'
import { createPinia } from 'pinia'
import { router } from './router'
import App from './App.vue'
import './style.css'
import { mdInline } from './parser'
import type { MdItem } from '@notatnik/shared'

// ItemList: renders a list of MdItems (tasks, tables, text)
// Registered globally so MarkdownRenderer can use it without circular imports
const ItemList = defineComponent({
  props: { items: Array as () => MdItem[], filename: String },
  emits: ['toggle'],
  setup(props, { emit }) {
    return () =>
      h('div', { class: 'md-items' },
        (props.items ?? []).map((item) => {
          if (item.type === 'task') {
            return h('label', { class: 'task-label', key: item.hash },
              [
                h('input', {
                  type: 'checkbox',
                  class: 'sr-only',
                  checked: item.checked,
                  onChange: () => emit('toggle', item),
                }),
                h('span', { class: ['checkbox-visual', { checked: item.checked }] },
                  item.checked
                    ? [h('svg', { viewBox: '0 0 12 10', fill: 'none' },
                        [h('path', { d: 'M1 5l3.5 3.5L11 1', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })])]
                    : []
                ),
                h('span', {
                  class: { 'task-done': item.checked },
                  innerHTML: mdInline(item.text ?? ''),
                }),
              ]
            )
          }
          if (item.type === 'table') {
            return h('div', { class: 'prd-text', key: String(Math.random()) },
              [h('table', { class: 'prd-table' }, [
                h('thead', [h('tr', (item.rows![0] ?? []).map((cell, i) => h('th', { key: i, innerHTML: mdInline(cell) })))]),
                h('tbody', (item.rows!.slice(1)).map((row, ri) =>
                  h('tr', { key: ri }, row.map((cell, ci) => h('td', { key: ci, innerHTML: mdInline(cell) })))
                )),
              ])]
            )
          }
          if (item.type === 'code') {
            return h('div', { class: 'code-block', key: item.code },
              [h('pre', item.lang ? [h('span', { class: 'code-lang' }, item.lang), h('code', {}, item.code ?? '')] : [h('code', {}, item.code ?? '')])]
            )
          }
          return h('div', { class: 'prd-text', key: item.text, innerHTML: mdInline(item.text ?? '') })
        })
      )
  },
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.component('ItemList', ItemList)
app.mount('#app')
