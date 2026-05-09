// apps/frontend/src/stores/settings.ts
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type CheckedStyle = 'strikethrough' | 'dim' | 'color' | 'none'
export type ContentWidth = 'narrow' | 'medium' | 'wide' | 'full'
export type Theme = 'dark' | 'light' | 'deep-night'

const STORAGE_KEY = 'notatnik-settings'
const THEME_KEY = 'notatnik-theme'

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

function loadTheme(): Theme {
  const t = localStorage.getItem(THEME_KEY)
  if (t === 'light' || t === 'deep-night' || t === 'dark') return t
  return 'dark'
}

export const useSettingsStore = defineStore('settings', () => {
  const initial = load()
  const checkedStyle = ref<CheckedStyle>(initial.checkedStyle)
  const contentWidth = ref<ContentWidth>(initial.contentWidth)
  const theme = ref<Theme>(loadTheme())

  watch([checkedStyle, contentWidth], () => {
    save({ checkedStyle: checkedStyle.value, contentWidth: contentWidth.value })
    applyToDOM()
  })

  watch(theme, (t) => {
    localStorage.setItem(THEME_KEY, t)
    document.documentElement.dataset.theme = t
  })

  function applyToDOM() {
    document.documentElement.dataset.checkedStyle = checkedStyle.value
    document.documentElement.dataset.theme = theme.value
    document.documentElement.style.setProperty(
      '--content-max-width',
      CONTENT_WIDTH_VALUES[contentWidth.value],
    )
  }

  applyToDOM()

  return { checkedStyle, contentWidth, theme }
})
