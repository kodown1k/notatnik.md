// apps/api/src/routes/files.ts
import { Hono } from 'hono'
import { readdirSync, readFileSync, statSync, existsSync } from 'fs'
import { join, resolve, normalize } from 'path'
import { getVaultPath } from './vault'
import type { FileInfo } from '@notatnik/shared'

export const filesRoutes = new Hono()

// Security middleware: reject any request with directory traversal in path
filesRoutes.use('/*', async (c, next) => {
  const path = c.req.path
  if (path.includes('..')) {
    return c.json({ error: 'invalid filename' }, 400)
  }
  return next()
})

filesRoutes.get('/', (c) => {
  const vaultPath = getVaultPath()
  if (!vaultPath || !existsSync(vaultPath)) {
    return c.json([] as FileInfo[])
  }

  const entries = readdirSync(vaultPath, { withFileTypes: true })
  const files: FileInfo[] = entries
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => {
      const stat = statSync(join(vaultPath, e.name))
      return {
        name: e.name.replace(/\.md$/, ''),
        filename: e.name,
        mtime: stat.mtimeMs,
        size: stat.size,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  return c.json(files)
})

filesRoutes.get('/:filename', (c) => {
  const vaultPath = getVaultPath()
  const filename = c.req.param('filename')

  if (!vaultPath) {
    return c.json({ error: 'vault not configured' }, 503)
  }

  // Security: reject paths with directory traversal characters
  const normalizedFilename = normalize(filename)
  if (normalizedFilename.includes('/') || normalizedFilename.includes('\\') || normalizedFilename.includes('..')) {
    return c.json({ error: 'invalid filename' }, 400)
  }

  const filePath = join(vaultPath, filename.endsWith('.md') ? filename : `${filename}.md`)

  // Secondary check: resolved path must be within vault
  if (!resolve(filePath).startsWith(resolve(vaultPath) + '/') && resolve(filePath) !== resolve(vaultPath)) {
    return c.json({ error: 'invalid filename' }, 400)
  }

  if (!existsSync(filePath)) {
    return c.json({ error: 'not found' }, 404)
  }

  const stat = statSync(filePath)
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
