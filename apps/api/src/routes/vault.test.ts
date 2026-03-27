// apps/api/src/routes/vault.test.ts
import { describe, test, expect, beforeEach } from 'bun:test'
import { testClient } from 'hono/testing'
import { Hono } from 'hono'
import { vaultRoutes, setVaultPath } from './vault'
import { tmpdir } from 'os'

const app = new Hono()
app.route('/api/vault', vaultRoutes)
const client = testClient(app)

describe('vault routes', () => {
  beforeEach(() => setVaultPath(''))

  test('GET /api/vault returns empty path initially', async () => {
    const res = await client.api.vault.$get()
    const body = await res.json()
    expect(body.path).toBe('')
  })

  test('POST /api/vault with valid dir sets vault path', async () => {
    const dir = tmpdir()
    const res = await client.api.vault.$post({ json: { path: dir } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.path).toBe(dir)
  })

  test('POST /api/vault with non-existent path returns 400', async () => {
    const res = await client.api.vault.$post({ json: { path: '/does/not/exist/xyz' } })
    expect(res.status).toBe(400)
  })

  test('POST /api/vault with empty path returns 400', async () => {
    const res = await client.api.vault.$post({ json: { path: '' } })
    expect(res.status).toBe(400)
  })
})
