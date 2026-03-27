<!-- apps/frontend/src/views/HomeView.vue -->
<template>
  <div class="home">
    <div class="home-card">
      <h1>notatnik.md</h1>
      <p class="subtitle">Otwórz katalog z plikami Markdown</p>

      <div class="input-row">
        <input
          v-model="pathInput"
          type="text"
          placeholder="/ścieżka/do/katalogu"
          list="vault-history"
          @keydown.enter="openVault"
          :class="{ error: errorMsg }"
        />
        <datalist id="vault-history">
          <option v-for="h in history" :key="h" :value="h" />
        </datalist>
        <button @click="openVault" :disabled="!pathInput.trim()">Otwórz</button>
      </div>

      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      <p v-if="loading" class="loading">Ładowanie...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useVaultStore } from '../stores/vault'

const router = useRouter()
const vaultStore = useVaultStore()

const pathInput = ref('')
const errorMsg = ref('')
const loading = ref(false)
const history = ref<string[]>([])

onMounted(() => {
  history.value = vaultStore.getHistory()
  if (vaultStore.vaultPath) {
    pathInput.value = vaultStore.vaultPath
  }
})

async function openVault() {
  const path = pathInput.value.trim()
  if (!path) return

  loading.value = true
  errorMsg.value = ''

  try {
    await vaultStore.setVault(path)
    history.value = vaultStore.getHistory()
    // Navigate to first file if available
    if (vaultStore.files.length > 0) {
      router.push(`/${vaultStore.files[0].filename}`)
    }
  } catch (e: any) {
    errorMsg.value = e.message ?? 'Nie udało się otworzyć katalogu'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.home {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - var(--navbar-h));
  padding: 24px;
}

.home-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 40px;
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

h1 { font-size: 1.6rem; font-weight: 800; color: var(--accent); }
.subtitle { color: var(--text-secondary); font-size: 0.9rem; }

.input-row { display: flex; gap: 8px; }

input[type="text"] {
  flex: 1;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-primary);
  font-size: 0.9rem;
  padding: 8px 12px;
  outline: none;
  transition: border-color var(--transition);
}

input[type="text"]:focus { border-color: var(--accent); }
input.error { border-color: #ef4444; }

button {
  background: var(--accent);
  border: none;
  border-radius: var(--radius);
  color: #000;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 8px 16px;
  transition: background var(--transition);
  white-space: nowrap;
}

button:hover:not(:disabled) { background: var(--accent-hover); }
button:disabled { opacity: 0.5; cursor: not-allowed; }

.error-msg { color: #ef4444; font-size: 0.85rem; }
.loading { color: var(--text-secondary); font-size: 0.85rem; }
</style>
