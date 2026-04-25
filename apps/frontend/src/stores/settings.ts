// apps/frontend/src/stores/settings.ts
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type CheckedStyle = 'strikethrough' | 'dim' | 'color' | 'none'
export type ContentWidth = 'narrow' | 'medium' | 'wide' | 'full'

const STORAGE_KEY = 'notatnik-settings'

const CONTENT_WIDTH_VALUES: Record<ContentWidth, string> = {
  narrow: '900px',
  medium: '1200px',
  wide: '1600px',
  full: '100%',
}

interface Settings {
  checkedStyle: CheckedStyle
  contentWidth: ContentWidth
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        checkedStyle: parsed.checkedStyle ?? 'strikethrough',
        contentWidth: parsed.contentWidth ?? 'narrow',
      }
    }
  } catch { /* ignore */ }
  return { checkedStyle: 'strikethrough', contentWidth: 'narrow' }
}

function save(state: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export const useSettingsStore = defineStore('settings', () => {
  const initial = load()
  const checkedStyle = ref<CheckedStyle>(initial.checkedStyle)
  const contentWidth = ref<ContentWidth>(initial.contentWidth)

  watch([checkedStyle, contentWidth], () => {
    save({ checkedStyle: checkedStyle.value, contentWidth: contentWidth.value })
    applyToDOM()
  })

  function applyToDOM() {
    document.documentElement.dataset.checkedStyle = checkedStyle.value
    document.documentElement.style.setProperty(
      '--content-max-width',
      CONTENT_WIDTH_VALUES[contentWidth.value],
    )
  }

  // Apply on init
  applyToDOM()

  return { checkedStyle, contentWidth }
})
