// apps/api/src/routes/vault.ts
import { Hono } from 'hono'
import { existsSync, statSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { VaultConfig } from '@notatnik/shared'

const SETTINGS_PATH = join(import.meta.dir, '../../../../settings.json')

function loadSettings(): VaultConfig {
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
  writeFileSync(SETTINGS_PATH, JSON.stringify(config, null, 2))
}

// In-memory state — single source of truth during runtime
let vaultConfig: VaultConfig = loadSettings()

export function getVaultPath(): string {
  return vaultConfig.path
}

export function setVaultPath(path: string) {
  vaultConfig = { path }
  saveSettings(vaultConfig)
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
