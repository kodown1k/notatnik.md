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
