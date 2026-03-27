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
          v-if="vaultStore.vaultPath"
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
        <ThemeToggle />
      </div>
    </header>

    <!-- Body: sidebar + content -->
    <div class="app-body">
      <Sidebar v-if="vaultStore.vaultPath" :class="{ 'sidebar-collapsed': !sidebarOpen }" />
      <main class="main-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useVaultStore } from './stores/vault'
import { useSseStore } from './stores/sse'
import Sidebar from './components/Sidebar.vue'
import ThemeToggle from './components/ThemeToggle.vue'

const router = useRouter()
const vaultStore = useVaultStore()
const sseStore = useSseStore()
const pathInput = ref('')
const sidebarOpen = ref(localStorage.getItem('notatnik-sidebar') !== 'closed')

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
  localStorage.setItem('notatnik-sidebar', sidebarOpen.value ? 'open' : 'closed')
}

onMounted(async () => {
  await vaultStore.loadVault()
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
    if (vaultStore.files.length > 0) {
      router.push(`/${vaultStore.files[0].filename}`)
    }
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
}
</style>
