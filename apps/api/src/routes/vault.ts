// apps/api/src/routes/vault.ts
import { Hono } from 'hono'
import { existsSync, statSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { VaultConfig } from '@notatnik/shared'
import { startWatcher } from '../watcher'
import type { SseEvent } from '@notatnik/shared'

const SETTINGS_PATH = join(import.meta.dir, '../../../../settings.json')

function loadSettings(): VaultConfig {
  if (process.env.VAULT_PATH) return { path: process.env.VAULT_PATH }
  if (existsSync(SETTINGS_PATH)) {
    try {
      return JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'))
    } catch {
      // ignore corrupt settings
    }
  }
  return { path: '' }
}

function saveSettings(config: VaultConfig) {
  if (process.env.VAULT_PATH) return  // env var takes precedence, skip file writes
  writeFileSync(SETTINGS_PATH, JSON.stringify(config, null, 2))
}

// In-memory state — single source of truth during runtime
let vaultConfig: VaultConfig = loadSettings()
startWatcher(vaultConfig.path)

const vaultListeners = new Set<(event: SseEvent) => void>()

export function addVaultListener(fn: (event: SseEvent) => void) {
  vaultListeners.add(fn)
}

export function removeVaultListener(fn: (event: SseEvent) => void) {
  vaultListeners.delete(fn)
}

export function getVaultPath(): string {
  return vaultConfig.path
}

export function setVaultPath(path: string) {
  vaultConfig = { path }
  saveSettings(vaultConfig)
  startWatcher(path)
  for (const fn of vaultListeners) fn({ type: 'vault:changed', path })
}

export const vaultRoutes = new Hono()

vaultRoutes.get('/', (c) => c.json(vaultConfig))

vaultRoutes.post('/', async (c) => {
  const body = await c.req.json<{ path: string }>()
  const newPath = body?.path?.trim() ?? ''

  if (!newPath) {
    return c.json({ error: 'path is required' }, 400)
  }

  if (!existsSync(newPath)) {
    return c.json({ error: 'path does not exist' }, 400)
  }

  const stat = statSync(newPath)
  if (!stat.isDirectory()) {
    return c.json({ error: 'path must be a directory' }, 400)
  }

  setVaultPath(newPath)
  return c.json({ path: newPath })
})
