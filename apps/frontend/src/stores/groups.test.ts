// apps/frontend/src/stores/groups.test.ts
// @vitest-environment happy-dom
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGroupsStore } from './groups'
import type { Group } from '@notatnik/shared'

describe('groups store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  test('groupsByPath maps paths to groups', () => {
    const store = useGroupsStore()
    store.$patch({
      groups: [
        { id: 1, name: 'A', color: '#c084fc', items: [{ id: 1, path: 'PRD.md', added_at: 0 }] },
        { id: 2, name: 'B', color: '#34d399', items: [{ id: 2, path: 'PRD.md', added_at: 0 }] },
      ] as Group[],
    })
    expect(store.groupsByPath.get('PRD.md')?.length).toBe(2)
    expect(store.groupsByPath.get('PRD.md')?.[0].name).toBe('A')
  })

  test('recentGroupIds is persisted to localStorage', () => {
    const store = useGroupsStore()
    store.markRecent(5)
    store.markRecent(3)
    store.markRecent(5)  // re-mark — should move to front
    expect(store.recentGroupIds).toEqual([5, 3])
    const saved = JSON.parse(localStorage.getItem('notatnik-recent-groups') ?? '[]')
    expect(saved).toEqual([5, 3])
  })

  test('fetchGroups populates state', async () => {
    const fakeData: Group[] = [{ id: 1, name: 'X', color: '#c084fc', items: [] }]
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(fakeData) } as any))
    const store = useGroupsStore()
    await store.fetchGroups()
    expect(store.groups).toEqual(fakeData)
  })
})
