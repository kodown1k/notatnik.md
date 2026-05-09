<!-- apps/frontend/src/App.vue -->
<template>
  <div class="app-root">
    <!-- Navbar -->
    <header class="navbar">
      <div class="navbar-left">
        <button v-if="vaultStore.vaultPath" class="sidebar-toggle" @click="toggleSidebar" :title="sidebarOpen ? 'Ukryj panel' : 'Pokaż panel'">
          <svg viewBox="0 0 18 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <line x1="0" y1="2" x2="18" y2="2"/>
            <line x1="0" y1="7" x2="18" y2="7"/>
            <line x1="0" y1="12" x2="18" y2="12"/>
          </svg>
        </button>
        <span class="logo" @click="router.push('/')">notatnik.md</span>
      </div>
      <div class="navbar-center">
        <input
          v-if="vaultStore.vaultPath && !vaultStore.vaultReadonly"
          v-model="pathInput"
          type="text"
          class="vault-input"
          list="vault-history-nav"
          placeholder="/ścieżka/do/vaultu"
          @keydown.enter="changeVault"
        />
        <datalist id="vault-history-nav">
          <option v-for="h in vaultStore.getHistory()" :key="h" :value="h" />
        </datalist>
      </div>
      <div class="navbar-right">
        <span v-if="sseStore.connected" class="sse-dot" title="Połączono z watcherem" />
        <button class="settings-btn" @click="showSettings = true" title="Ustawienia">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
        <ThemeToggle />
      </div>
    </header>

    <SettingsPanel v-if="showSettings" @close="showSettings = false" />

    <!-- Body: sidebar + content -->
    <div class="app-body">
      <Sidebar v-if="vaultStore.vaultPath" :class="{ 'sidebar-collapsed': !sidebarOpen }" />
      <main class="main-content" ref="mainContentEl" @scroll="onMainScroll">
        <router-view />
      </main>
    </div>

    <!-- Floating back-to-top button -->
    <button
      v-show="showBackToTop"
      class="back-to-top"
      @click="scrollToTop"
      title="Wróć na górę"
      aria-label="Wróć na górę dokumentu"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useVaultStore } from './stores/vault'
import { useSseStore } from './stores/sse'
import { useGroupsStore } from './stores/groups'
import Sidebar from './components/Sidebar.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import { useSettingsStore } from './stores/settings'

const router = useRouter()
const vaultStore = useVaultStore()
const sseStore = useSseStore()
const groupsStore = useGroupsStore()
useSettingsStore() // init settings (applies data-checked-style to DOM)
const pathInput = ref('')
const showSettings = ref(false)
const sidebarOpen = ref(localStorage.getItem('notatnik-sidebar') !== 'closed')
const mainContentEl = ref<HTMLElement | null>(null)
const showBackToTop = ref(false)

function onMainScroll() {
  const el = mainContentEl.value
  if (!el) return
  showBackToTop.value = el.scrollTop > 400
}

function scrollToTop() {
  mainContentEl.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
  localStorage.setItem('notatnik-sidebar', sidebarOpen.value ? 'open' : 'closed')
}

onMounted(async () => {
  await vaultStore.loadVault()
  await groupsStore.fetchGroups()
  pathInput.value = vaultStore.vaultPath
  sseStore.connect()
})

watch(() => vaultStore.vaultPath, (val) => {
  pathInput.value = val
})

async function changeVault() {
  const path = pathInput.value.trim()
  if (!path || path === vaultStore.vaultPath) return
  try {
    await vaultStore.setVault(path)
    const first = vaultStore.firstFile()
    if (first) router.push(`/${first.path}`)
  } catch (e: any) {
    alert(e.message ?? 'Błąd zmiany vaultu')
    pathInput.value = vaultStore.vaultPath
  }
}
</script>

<style scoped>
.app-root { display: flex; flex-direction: column; height: 100vh; }

.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--navbar-h);
  z-index: 100;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 16px;
}

.navbar-left { flex-shrink: 0; display: flex; align-items: center; gap: 10px; }

.sidebar-toggle {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: color var(--transition), background var(--transition);
}

.sidebar-toggle:hover { color: var(--text-primary); background: var(--bg-hover); }
.sidebar-toggle svg { width: 18px; height: 14px; }

.logo {
  font-size: 1rem;
  font-weight: 800;
  color: var(--accent);
  cursor: pointer;
  letter-spacing: -0.01em;
}

.navbar-center { flex: 1; min-width: 0; }

.vault-input {
  width: 100%;
  max-width: 480px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-secondary);
  font-size: 0.8rem;
  padding: 5px 10px;
  outline: none;
  font-family: var(--font-mono);
  transition: border-color var(--transition), color var(--transition);
}

.vault-input:focus {
  border-color: var(--accent);
  color: var(--text-primary);
}

.navbar-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.sse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 6px #22c55e88;
}

.settings-btn {
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

.settings-btn:hover { color: var(--accent); border-color: var(--accent); }
.settings-btn svg { width: 18px; height: 18px; }

.app-body {
  display: flex;
  margin-top: var(--navbar-h);
  height: calc(100vh - var(--navbar-h));
  overflow: hidden;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  min-width: 0;
  background: var(--bg-primary);
}

/* ── Floating back-to-top ───────────────────── */

.back-to-top {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 90;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(10px) saturate(1.3);
  transition: color var(--transition), border-color var(--transition),
    background var(--transition), transform var(--transition);
}

.back-to-top:hover {
  color: var(--accent);
  border-color: var(--accent);
  transform: translateY(-2px);
}

.back-to-top svg { width: 18px; height: 18px; }

[data-theme="light"] .back-to-top {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}
</style>
