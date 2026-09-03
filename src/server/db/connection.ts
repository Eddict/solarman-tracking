import sql from 'mssql'

import { env } from '@/lib/env'
import { ensureSchema } from '@/server/db/migrate'

let pool: sql.ConnectionPool | null = null

export function getPool() {
  if (!pool) {
    pool = new sql.ConnectionPool({
      user: env.MSSQL_USER,
      password: env.MSSQL_PASSWORD,
      server: env.MSSQL_SERVER,
      port: Number(env.MSSQL_PORT),
      database: env.MSSQL_DATABASE,
      pool: { max: 10 },
      options: {
        encrypt: env.MSSQL_ENCRYPT === 'true',
        trustServerCertificate: env.MSSQL_TRUST_SERVER_CERTIFICATE === 'true',
      },
    })
  }

  return pool
}

export async function withConnection<T>(
  fn: (connection: sql.ConnectionPool) => Promise<T>,
) {
  await ensureSchema()
  const connection = getPool() as sql.ConnectionPool

  if (!connection.connected) {
    await connection.connect()
  }

  return fn(connection)
}

export async function closePool() {
  if (pool) {
    await pool.close()
    pool = null
  }
}