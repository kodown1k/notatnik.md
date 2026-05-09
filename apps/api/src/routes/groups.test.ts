// apps/api/src/routes/groups.test.ts
import { describe, test, expect, beforeEach } from 'bun:test'
import { testClient } from 'hono/testing'
import { Hono } from 'hono'
import { tmpdir } from 'os'
import { join } from 'path'
import { unlinkSync, existsSync } from 'fs'

// Use fresh DB file per test process
const TEST_DB = join(tmpdir(), `groups-test-${process.pid}.db`)
process.env.GROUPS_DB_PATH = TEST_DB

const { groupsRoutes } = await import('./groups')
const { groupsDb } = await import('../db/groups')

const app = new Hono()
app.route('/api/groups', groupsRoutes)
const client = testClient(app)

function reset() {
  groupsDb.exec('DELETE FROM group_items; DELETE FROM groups;')
}

describe('groups routes — GET', () => {
  beforeEach(reset)

  test('GET /api/groups returns empty array initially', async () => {
    const res = await client.api.groups.$get()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })
})

describe('groups routes — POST', () => {
  beforeEach(reset)

  test('POST /api/groups creates new group', async () => {
    const res = await client.api.groups.$post({ json: { name: 'Projekt Alpha', color: '#c084fc' } })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBeGreaterThan(0)
    expect(body.name).toBe('Projekt Alpha')
    expect(body.color).toBe('#c084fc')
    expect(body.items).toEqual([])
  })

  test('POST /api/groups with empty name returns 400', async () => {
    const res = await client.api.groups.$post({ json: { name: '', color: '#c084fc' } })
    expect(res.status).toBe(400)
  })

  test('POST /api/groups with missing color returns 400', async () => {
    const res = await client.api.groups.$post({ json: { name: 'X' } as any })
    expect(res.status).toBe(400)
  })
})

describe('groups routes — PATCH/DELETE', () => {
  beforeEach(reset)

  test('PATCH /api/groups/:id renames group', async () => {
    const created = await (await client.api.groups.$post({ json: { name: 'Old', color: '#c084fc' } })).json()
    const res = await client.api.groups[':id'].$patch({ param: { id: String(created.id) }, json: { name: 'New' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('New')
    expect(body.color).toBe('#c084fc')
  })

  test('PATCH /api/groups/:id changes color', async () => {
    const created = await (await client.api.groups.$post({ json: { name: 'X', color: '#c084fc' } })).json()
    const res = await client.api.groups[':id'].$patch({ param: { id: String(created.id) }, json: { color: '#34d399' } })
    expect(res.status).toBe(200)
    expect((await res.json()).color).toBe('#34d399')
  })

  test('PATCH /api/groups/:id with non-existent id returns 404', async () => {
    const res = await client.api.groups[':id'].$patch({ param: { id: '99999' }, json: { name: 'X' } })
    expect(res.status).toBe(404)
  })

  test('DELETE /api/groups/:id removes group', async () => {
    const created = await (await client.api.groups.$post({ json: { name: 'X', color: '#c084fc' } })).json()
    const res = await client.api.groups[':id'].$delete({ param: { id: String(created.id) } })
    expect(res.status).toBe(204)
    const list = await (await client.api.groups.$get()).json()
    expect(list).toEqual([])
  })

  test('DELETE /api/groups/:id with non-existent id returns 404', async () => {
    const res = await client.api.groups[':id'].$delete({ param: { id: '99999' } })
    expect(res.status).toBe(404)
  })
})

describe('groups routes — items', () => {
  beforeEach(reset)

  async function makeGroup() {
    return await (await client.api.groups.$post({ json: { name: 'G', color: '#c084fc' } })).json()
  }

  test('POST /api/groups/:id/items adds path', async () => {
    const g = await makeGroup()
    const res = await client.api.groups[':id'].items.$post({ param: { id: String(g.id) }, json: { path: 'PRD.md' } })
    expect(res.status).toBe(201)
    const item = await res.json()
    expect(item.path).toBe('PRD.md')
    expect(item.id).toBeGreaterThan(0)
  })

  test('POST /api/groups/:id/items duplicate is idempotent (returns existing)', async () => {
    const g = await makeGroup()
    const r1 = await (await client.api.groups[':id'].items.$post({ param: { id: String(g.id) }, json: { path: 'PRD.md' } })).json()
    const r2 = await client.api.groups[':id'].items.$post({ param: { id: String(g.id) }, json: { path: 'PRD.md' } })
    expect(r2.status).toBe(200)
    const item = await r2.json()
    expect(item.id).toBe(r1.id)
  })

  test('POST /api/groups/:id/items with empty path returns 400', async () => {
    const g = await makeGroup()
    const res = await client.api.groups[':id'].items.$post({ param: { id: String(g.id) }, json: { path: '' } })
    expect(res.status).toBe(400)
  })

  test('POST to non-existent group returns 404', async () => {
    const res = await client.api.groups[':id'].items.$post({ param: { id: '99999' }, json: { path: 'PRD.md' } })
    expect(res.status).toBe(404)
  })

  test('DELETE /api/groups/:id/items/:itemId removes item', async () => {
    const g = await makeGroup()
    const item = await (await client.api.groups[':id'].items.$post({ param: { id: String(g.id) }, json: { path: 'PRD.md' } })).json()
    const res = await client.api.groups[':id'].items[':itemId'].$delete({ param: { id: String(g.id), itemId: String(item.id) } })
    expect(res.status).toBe(204)
  })

  test('DELETE /api/groups/items/by-path removes from all groups', async () => {
    const g1 = await makeGroup()
    const g2 = await makeGroup()
    await client.api.groups[':id'].items.$post({ param: { id: String(g1.id) }, json: { path: 'PRD.md' } })
    await client.api.groups[':id'].items.$post({ param: { id: String(g2.id) }, json: { path: 'PRD.md' } })

    const res = await client.api.groups.items['by-path'].$delete({ query: { path: 'PRD.md' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.removed).toBe(2)

    const list = await (await client.api.groups.$get()).json()
    expect(list[0].items).toEqual([])
    expect(list[1].items).toEqual([])
  })
})
