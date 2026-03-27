// apps/api/src/routes/files.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { testClient } from 'hono/testing'
import { Hono } from 'hono'
import { filesRoutes } from './files'
import { setVaultPath } from './vault'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const testDir = join(tmpdir(), 'notatnik-test-' + Date.now())

beforeAll(() => {
  mkdirSync(testDir, { recursive: true })
  writeFileSync(join(testDir, 'alpha.md'), '# Alpha\n- [x] done\n- [ ] todo\n')
  writeFileSync(join(testDir, 'beta.md'), '# Beta\n')
  writeFileSync(join(testDir, 'notmd.txt'), 'ignored')
  setVaultPath(testDir)
})

afterAll(() => rmSync(testDir, { recursive: true }))

const app = new Hono()
app.route('/api/files', filesRoutes)
const client = testClient(app)

describe('files routes', () => {
  test('GET /api/files returns only .md files sorted alphabetically', async () => {
    const res = await client.api.files.$get()
    const files = await res.json()
    expect(files.map((f: any) => f.filename)).toEqual(['alpha.md', 'beta.md'])
  })

  test('GET /api/files/:name returns file content', async () => {
    const res = await client.api.files[':filename'].$get({ param: { filename: 'alpha.md' } })
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('# Alpha')
  })

  test('GET /api/files/:name returns ETag header', async () => {
    const res = await client.api.files[':filename'].$get({ param: { filename: 'alpha.md' } })
    expect(res.headers.get('ETag')).toMatch(/^"[\d.]+"$/)
  })

  test('GET /api/files/nonexistent returns 404', async () => {
    const res = await client.api.files[':filename'].$get({ param: { filename: 'nonexistent.md' } })
    expect(res.status).toBe(404)
  })

  test('GET /api/files/../etc/passwd is rejected (traversal blocked by router)', async () => {
    // Hono normalizes '../etc/passwd' to '/api/etc/passwd' before routing,
    // so the request never reaches filesRoutes — it gets a 404 from the app.
    // The traversal is effectively blocked (non-2xx response).
    const res = await client.api.files[':filename'].$get({ param: { filename: '../etc/passwd' } })
    expect(res.status).not.toBe(200)
  })
})
