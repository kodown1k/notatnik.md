// apps/api/src/routes/files.ts
import { Hono } from 'hono'
import { readdirSync, readFileSync, statSync, existsSync, realpathSync } from 'fs'
import { join, resolve, relative } from 'path'
import { getVaultPath } from './vault'
import type { TreeNode } from '@notatnik/shared'

export const filesRoutes = new Hono()

// Security middleware: reject any request with directory traversal in path
filesRoutes.use('/*', async (c, next) => {
  if (c.req.path.includes('..')) {
    return c.json({ error: 'invalid filename' }, 400)
  }
  return next()
})

function buildTree(dirPath: string, vaultPath: string): TreeNode[] {
  let entries
  try {
    entries = readdirSync(dirPath, { withFileTypes: true })
  } catch {
    return []
  }

  const dirs: TreeNode[] = []
  const files: TreeNode[] = []

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)
    const relPath = relative(vaultPath, fullPath)

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      const children = buildTree(fullPath, vaultPath)
      if (children.length > 0) {
        dirs.push({ type: 'dir', name: entry.name, path: relPath, children })
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      let stat
      try {
        stat = statSync(fullPath)
      } catch {
        continue
      }
      files.push({
        type: 'file',
        name: entry.name.replace(/\.md$/, ''),
        path: relPath,
        filename: relPath,
        mtime: stat.mtimeMs,
        size: stat.size,
      })
    }
  }

  dirs.sort((a, b) => a.name.localeCompare(b.name))
  files.sort((a, b) => a.name.localeCompare(b.name))
  return [...dirs, ...files]
}

filesRoutes.get('/', (c) => {
  const vaultPath = getVaultPath()
  if (!vaultPath || !existsSync(vaultPath)) {
    return c.json([] as TreeNode[])
  }
  return c.json(buildTree(vaultPath, vaultPath))
})

filesRoutes.get('/*', (c) => {
  const vaultPath = getVaultPath()
  if (!vaultPath) {
    return c.json({ error: 'vault not configured' }, 503)
  }

  // Extract relative path: strip the route mount prefix (e.g. /api/files/)
  const routePrefix = c.req.routePath.replace('/*', '')
  const relPath = c.req.path.slice(routePrefix.length + 1)
  if (!relPath) {
    return c.json({ error: 'invalid filename' }, 400)
  }

  const filePath = join(vaultPath, relPath.endsWith('.md') ? relPath : `${relPath}.md`)

  // Verify resolved path stays within vault
  const resolvedVault = resolve(vaultPath)
  const resolvedFile = resolve(filePath)
  if (!resolvedFile.startsWith(resolvedVault + '/')) {
    return c.json({ error: 'invalid filename' }, 400)
  }

  // Resolve symlinks and re-verify (also catches ENOENT, ELOOP, etc.)
  let realFilePath: string
  let realVaultPath: string
  try {
    realFilePath = realpathSync(filePath)
    realVaultPath = realpathSync(vaultPath)
  } catch {
    return c.json({ error: 'not found' }, 404)
  }
  if (!realFilePath.startsWith(realVaultPath + '/')) {
    return c.json({ error: 'invalid filename' }, 400)
  }

  let stat
  try {
    stat = statSync(filePath)
  } catch {
    return c.json({ error: 'not found' }, 404)
  }
  const etag = `"${stat.mtimeMs}"`
  const ifNoneMatch = c.req.header('If-None-Match')
  if (ifNoneMatch === etag) {
    return new Response(null, { status: 304 })
  }

  const content = readFileSync(filePath, 'utf8')
  return new Response(content, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'ETag': etag,
      'Last-Modified': stat.mtime.toUTCString(),
      'Cache-Control': 'no-cache',
    },
  })
})
