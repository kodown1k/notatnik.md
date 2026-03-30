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
const subDir = join(testDir, 'subdir')

beforeAll(() => {
  mkdirSync(testDir, { recursive: true })
  mkdirSync(subDir, { recursive: true })
  writeFileSync(join(testDir, 'alpha.md'), '# Alpha\n- [x] done\n- [ ] todo\n')
  writeFileSync(join(testDir, 'beta.md'), '# Beta\n')
  writeFileSync(join(testDir, 'notmd.txt'), 'ignored')
  writeFileSync(join(subDir, 'gamma.md'), '# Gamma\n')
  setVaultPath(testDir)
})

afterAll(() => rmSync(testDir, { recursive: true }))

const app = new Hono()
app.route('/api/files', filesRoutes)
const client = testClient(app)

describe('files routes', () => {
  test('GET /api/files returns tree with dirs first, then files', async () => {
    const res = await client.api.files.$get()
    const tree = await res.json() as any[]
    // top level: dir "subdir" first, then files "alpha", "beta"
    expect(tree[0].type).toBe('dir')
    expect(tree[0].name).toBe('subdir')
    expect(tree[1].type).toBe('file')
    expect(tree[1].name).toBe('alpha')
    expect(tree[2].type).toBe('file')
    expect(tree[2].name).toBe('beta')
  })

  test('GET /api/files returns dir with children', async () => {
    const res = await client.api.files.$get()
    const tree = await res.json() as any[]
    const subdir = tree[0]
    expect(subdir.children).toHaveLength(1)
    expect(subdir.children[0].name).toBe('gamma')
    expect(subdir.children[0].path).toBe('subdir/gamma.md')
    expect(subdir.children[0].filename).toBe('subdir/gamma.md')
  })

  test('GET /api/files does not include non-.md files', async () => {
    const res = await client.api.files.$get()
    const tree = await res.json() as any[]
    const allPaths = tree
      .flatMap((n: any) => n.type === 'file' ? [n.path] : (n.children ?? []).map((c: any) => c.path))
    expect(allPaths.every((p: string) => p.endsWith('.md'))).toBe(true)
  })

  test('GET /api/files/:name returns root file content', async () => {
    const res = await client.api.files[':filename'].$get({ param: { filename: 'alpha.md' } })
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('# Alpha')
  })

  test('GET /api/files/:name returns ETag header', async () => {
    const res = await client.api.files[':filename'].$get({ param: { filename: 'alpha.md' } })
    expect(res.headers.get('ETag')).toMatch(/^"[\d.]+"$/)
  })

  test('GET /api/files/subdir/gamma.md returns nested file content', async () => {
    // testClient doesn't handle slashes in params — use app.request() directly
    const appRes = await app.request('/api/files/subdir/gamma.md')
    expect(appRes.status).toBe(200)
    const text = await appRes.text()
    expect(text).toContain('# Gamma')
  })

  test('GET /api/files/nonexistent returns 404', async () => {
    const res = await client.api.files[':filename'].$get({ param: { filename: 'nonexistent.md' } })
    expect(res.status).toBe(404)
  })

  test('GET /api/files/../etc/passwd is rejected', async () => {
    const res = await client.api.files[':filename'].$get({ param: { filename: '../etc/passwd' } })
    expect(res.status).not.toBe(200)
  })
})
