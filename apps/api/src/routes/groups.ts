// apps/api/src/routes/groups.ts
import { Hono } from 'hono'
import { groupsDb } from '../db/groups'
import type { Group } from '@notatnik/shared'

export const groupsRoutes = new Hono()

groupsRoutes.get('/', (c) => {
  const groups = groupsDb.query('SELECT id, name, color FROM groups ORDER BY id ASC').all() as Array<Omit<Group, 'items'>>
  const items = groupsDb.query('SELECT id, group_id, path, added_at FROM group_items ORDER BY added_at ASC').all() as Array<{ id: number; group_id: number; path: string; added_at: number }>
  const byGroup = new Map<number, Group['items']>()
  for (const it of items) {
    if (!byGroup.has(it.group_id)) byGroup.set(it.group_id, [])
    byGroup.get(it.group_id)!.push({ id: it.id, path: it.path, added_at: it.added_at })
  }
  const result: Group[] = groups.map((g) => ({ ...g, items: byGroup.get(g.id) ?? [] }))
  return c.json(result)
})

groupsRoutes.post('/', async (c) => {
  const body = await c.req.json<{ name?: string; color?: string }>().catch(() => ({}))
  const name = body.name?.trim()
  const color = body.color?.trim()
  if (!name) return c.json({ error: 'name is required' }, 400)
  if (!color) return c.json({ error: 'color is required' }, 400)

  const result = groupsDb.query('INSERT INTO groups (name, color) VALUES (?, ?) RETURNING id').get(name, color) as { id: number }
  return c.json({ id: result.id, name, color, items: [] }, 201)
})

groupsRoutes.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400)

  const body = await c.req.json<{ name?: string; color?: string }>().catch(() => ({}))
  const existing = groupsDb.query('SELECT id, name, color FROM groups WHERE id = ?').get(id) as { id: number; name: string; color: string } | null
  if (!existing) return c.json({ error: 'not found' }, 404)

  const newName = body.name?.trim() || existing.name
  const newColor = body.color?.trim() || existing.color
  groupsDb.run('UPDATE groups SET name = ?, color = ? WHERE id = ?', [newName, newColor, id])

  return c.json({ id, name: newName, color: newColor })
})

groupsRoutes.delete('/:id', (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400)
  const res = groupsDb.run('DELETE FROM groups WHERE id = ?', [id])
  if (res.changes === 0) return c.json({ error: 'not found' }, 404)
  return c.body(null, 204)
})
