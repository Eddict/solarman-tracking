import sql from 'mssql'

import type { AppConfig } from '@/lib/config/schema'
import { withConnection } from '@/server/db/connection'

export async function readAppConfigRaw(): Promise<AppConfig | null> {
  return withConnection(async (connection) => {
    const result = await connection.request().query<{ config: string }>(
      'SELECT config FROM dbo.app_config WHERE id = 1',
    )
    const row = result.recordset[0]
    return row ? JSON.parse(row.config) as AppConfig : null
  })
}

export async function upsertAppConfig(config: AppConfig) {
  await withConnection(async (connection) => {
    await connection.request().input('config', sql.NVarChar(sql.MAX), JSON.stringify(config))
      .query(`UPDATE dbo.app_config SET config = @config WHERE id = 1;
              IF @@ROWCOUNT = 0 INSERT INTO dbo.app_config (id, config) VALUES (1, @config);`)
  })
}