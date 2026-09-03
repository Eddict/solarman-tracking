import sql from 'mssql'

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getPool } from '@/server/db/connection'

let schemaReady: Promise<void> | null = null

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
)

export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = applySchema().catch((error) => {
      schemaReady = null
      throw error
    })
  }

  return schemaReady
}

async function applySchema() {
  const pool = getPool() as sql.ConnectionPool

  if (!pool.connected) {
    await pool.connect()
  }

  const filePath = path.join(projectRoot, '../docker/mssql/schema.sql')
  const sql = await readFile(filePath, 'utf8')
  const batches = sql
    .split(/^\s*GO\s*$/im)
    .map((batch) => batch.trim())
    .filter((batch) => batch.length > 0)

  for (const batch of batches) {
    await pool.request().batch(batch)
  }
}