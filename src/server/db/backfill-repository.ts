import sql from 'mssql'

import { withConnection } from '@/server/db/connection'

export type BackfillCheckpointRow = {
  station_id: number
  first_data_at: Date | null
  last_synced_at: Date | null
  no_data_before: Date | null
}

export type BackfillGapStatus = 'open' | 'filled' | 'ignored'

export async function getBackfillCheckpoint(stationId: number) {
  return withConnection(async (connection) => {
    const result = await connection.request().input('station_id', sql.Int, stationId)
      .query<BackfillCheckpointRow>(`SELECT station_id, first_data_at, last_synced_at, no_data_before
        FROM dbo.backfill_checkpoint WHERE station_id = @station_id`)
    return result.recordset[0] ?? null
  })
}

export async function upsertBackfillCheckpoint(input: {
  stationId: number
  firstDataAt?: Date | null
  lastSyncedAt?: Date | null
  noDataBefore?: Date | null
}) {
  await withConnection(async (connection) => {
    await connection.request()
      .input('station_id', sql.Int, input.stationId)
      .input('first_data_at', sql.DateTime2(3), input.firstDataAt ?? null)
      .input('last_synced_at', sql.DateTime2(3), input.lastSyncedAt ?? null)
      .input('no_data_before', sql.DateTime2(3), input.noDataBefore ?? null)
      .query(`UPDATE dbo.backfill_checkpoint
              SET first_data_at = COALESCE(@first_data_at, first_data_at),
                  last_synced_at = COALESCE(@last_synced_at, last_synced_at),
                  no_data_before = COALESCE(@no_data_before, no_data_before)
              WHERE station_id = @station_id;
              IF @@ROWCOUNT = 0
                INSERT INTO dbo.backfill_checkpoint (station_id, first_data_at, last_synced_at, no_data_before)
                VALUES (@station_id, @first_data_at, @last_synced_at, @no_data_before);`)
  })
}

export async function recordBackfillGap(input: {
  stationId: number
  gapStart: Date
  gapEnd: Date
  status?: BackfillGapStatus
}) {
  await withConnection(async (connection) => {
    await connection.request()
      .input('station_id', sql.Int, input.stationId)
      .input('gap_start', sql.DateTime2(3), input.gapStart)
      .input('gap_end', sql.DateTime2(3), input.gapEnd)
      .input('status', sql.VarChar(16), input.status ?? 'open')
      .query(`INSERT INTO dbo.backfill_gap (station_id, gap_start, gap_end, status)
              VALUES (@station_id, @gap_start, @gap_end, @status)`)
  })
}

export async function getOpenBackfillGaps(stationId: number) {
  return withConnection(async (connection) => {
    const result = await connection.request().input('station_id', sql.Int, stationId)
      .query<{ id: number; gap_start: Date; gap_end: Date }>(`SELECT id, gap_start, gap_end
        FROM dbo.backfill_gap WHERE station_id = @station_id AND status = 'open'
        ORDER BY gap_start ASC`)
    return result.recordset
  })
}