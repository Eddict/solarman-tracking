import sql from 'mssql'
import type { IResult } from 'mssql'

import type {
  ArchiveDirection,
  ArchiveRun,
  ArchiveRunStatus,
} from '@/features/archive/types'
import { withConnection } from '@/server/db/connection'

// Plain interface; no longer needs to extend RowDataPacket
type ArchiveRunRow = {
  id: number
  station_id: number
  direction: ArchiveDirection
  day_from: string
  day_to: string
  days_count: number
  rows_affected: number
  status: ArchiveRunStatus
  error_message: string | null
  created_at: Date
}

function mapRow(row: ArchiveRunRow): ArchiveRun {
  return {
    id: row.id,
    stationId: row.station_id,
    direction: row.direction,
    dayFrom: row.day_from,
    dayTo: row.day_to,
    daysCount: Number(row.days_count),
    rowsAffected: Number(row.rows_affected),
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  }
}

export async function insertArchiveRun(input: {
  stationId: number
  direction: ArchiveDirection
  dayFrom: string
  dayTo: string
  daysCount: number
  rowsAffected: number
  status: ArchiveRunStatus
  errorMessage?: string | null
}) {
  // Assuming withConnection provides a connection pool or request runner
  return withConnection(async (connection) => {
    const request = new sql.Request(connection)

    // Bind parameters explicitly with correct MSSQL data types
    request.input('stationId', sql.Int, input.stationId)
    request.input('direction', sql.VarChar, input.direction)
    request.input('dayFrom', sql.VarChar, input.dayFrom)
    request.input('dayTo', sql.VarChar, input.dayTo)
    request.input('daysCount', sql.Int, input.daysCount)
    request.input('rowsAffected', sql.Int, input.rowsAffected)
    request.input('status', sql.VarChar, input.status)
    request.input('errorMessage', sql.VarChar, input.errorMessage ?? null)

    // Using OUTPUT INSERTED allows returning the row immediately, bypassing an extra SELECT query
    const result: IResult<ArchiveRunRow> = await request.query(`
      INSERT INTO archive_runs
        (station_id, direction, day_from, day_to, days_count, rows_affected, status, error_message)
      OUTPUT 
        INSERTED.id, INSERTED.station_id, INSERTED.direction, INSERTED.day_from, 
        INSERTED.day_to, INSERTED.days_count, INSERTED.rows_affected, INSERTED.status, 
        INSERTED.error_message, INSERTED.created_at
      VALUES 
        (@stationId, @direction, @dayFrom, @dayTo, @daysCount, @rowsAffected, @status, @errorMessage)
    `)

    return mapRow(result.recordset[0])
  })
}

export async function listArchiveRuns(stationId: number, limit = 20) {
  return withConnection(async (connection) => {
    const request = new sql.Request(connection)
    
    request.input('stationId', sql.Int, stationId)
    request.input('limit', sql.Int, limit)

    // Using TOP (@limit) for SQL Server pagination syntax
    const result: IResult<ArchiveRunRow> = await request.query(`
      SELECT TOP (@limit) id, station_id, direction, day_from, day_to, days_count, rows_affected,
                          status, error_message, created_at
      FROM archive_runs
      WHERE station_id = @stationId
      ORDER BY created_at DESC
    `)

    return result.recordset.map(mapRow)
  })
}

export async function getLatestArchiveRun(stationId: number) {
  return withConnection(async (connection) => {
    const request = new sql.Request(connection)
    
    request.input('stationId', sql.Int, stationId)

    const result: IResult<ArchiveRunRow> = await request.query(`
      SELECT TOP (1) id, station_id, direction, day_from, day_to, days_count, rows_affected,
                     status, error_message, created_at
      FROM archive_runs
      WHERE station_id = @stationId
      ORDER BY created_at DESC
    `)

    const row = result.recordset[0]
    if (!row) {
      return null
    }

    return mapRow(row)
  })
}
