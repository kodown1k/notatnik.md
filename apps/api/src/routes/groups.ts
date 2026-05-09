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
