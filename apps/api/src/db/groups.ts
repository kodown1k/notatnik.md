// apps/api/src/db/groups.ts
import { Database } from 'bun:sqlite'
import { join } from 'path'

const DB_PATH = process.env.GROUPS_DB_PATH ?? join(import.meta.dir, '../../../../groups.db')

export const groupsDb = new Database(DB_PATH, { create: true })

groupsDb.exec('PRAGMA journal_mode=WAL')
groupsDb.exec('PRAGMA foreign_keys=ON')

groupsDb.exec(`
  CREATE TABLE IF NOT EXISTS groups (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL,
    color TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS group_items (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    path      TEXT NOT NULL,
    added_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(group_id, path)
  );

  CREATE INDEX IF NOT EXISTS idx_group_items_path ON group_items(path);
`)
