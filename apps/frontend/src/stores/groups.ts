// apps/frontend/src/stores/groups.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Group, GroupItem } from '@notatnik/shared'

const RECENT_KEY = 'notatnik-recent-groups'
const MAX_RECENT = 3

export const useGroupsStore = defineStore('groups', () => {
  const groups = ref<Group[]>([])
  const draggingPath = ref<string | null>(null)

  const initialRecent: number[] = (() => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') }
    catch { return [] }
  })()
  const recentGroupIds = ref<number[]>(initialRecent)

  const groupsByPath = computed(() => {
    const map = new Map<string, Group[]>()
    for (const g of groups.value) {
      for (const it of g.items) {
        if (!map.has(it.path)) map.set(it.path, [])
        map.get(it.path)!.push(g)
      }
    }
    return map
  })

  const recentGroups = computed(() =>
    recentGroupIds.value
      .map((id) => groups.value.find((g) => g.id === id))
      .filter((g): g is Group => !!g)
  )

  function markRecent(id: number) {
    const next = [id, ...recentGroupIds.value.filter((x) => x !== id)].slice(0, MAX_RECENT)
    recentGroupIds.value = next
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  }

  async function fetchGroups() {
    const res = await fetch('/api/groups')
    if (!res.ok) throw new Error('fetch groups failed')
    groups.value = await res.json()
  }

  async function createGroup(name: string, color: string): Promise<Group> {
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    })
    if (!res.ok) throw new Error('create group failed')
    const created: Group = await res.json()
    groups.value = [...groups.value, created]
    return created
  }

  async function updateGroup(id: number, patch: { name?: string; color?: string }) {
    const res = await fetch(`/api/groups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error('update group failed')
    const updated = await res.json()
    const idx = groups.value.findIndex((g) => g.id === id)
    if (idx >= 0) groups.value[idx] = { ...groups.value[idx], ...updated }
  }

  async function deleteGroup(id: number) {
    const res = await fetch(`/api/groups/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('delete group failed')
    groups.value = groups.value.filter((g) => g.id !== id)
    recentGroupIds.value = recentGroupIds.value.filter((x) => x !== id)
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentGroupIds.value))
  }

  async function addItem(groupId: number, path: string): Promise<GroupItem> {
    const res = await fetch(`/api/groups/${groupId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    })
    if (!res.ok) throw new Error('add item failed')
    const item: GroupItem = await res.json()
    const group = groups.value.find((g) => g.id === groupId)
    if (group && !group.items.some((i) => i.id === item.id)) {
      group.items = [...group.items, item]
    }
    markRecent(groupId)
    return item
  }

  async function removeItem(groupId: number, itemId: number) {
    const res = await fetch(`/api/groups/${groupId}/items/${itemId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('remove item failed')
    const group = groups.value.find((g) => g.id === groupId)
    if (group) group.items = group.items.filter((i) => i.id !== itemId)
  }

  async function removeFromAllGroups(path: string) {
    const url = `/api/groups/items/by-path?path=${encodeURIComponent(path)}`
    const res = await fetch(url, { method: 'DELETE' })
    if (!res.ok) throw new Error('remove all failed')
    for (const g of groups.value) {
      g.items = g.items.filter((i) => i.path !== path)
    }
  }

  return {
    groups,
    draggingPath,
    recentGroupIds,
    recentGroups,
    groupsByPath,
    fetchGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    addItem,
    removeItem,
    removeFromAllGroups,
    markRecent,
  }
})
