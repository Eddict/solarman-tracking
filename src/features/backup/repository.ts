import sql from 'mssql'
import type { IResult } from 'mssql'
import { withConnection } from '@/server/db/connection'
import type { BackupSource } from '@/features/backup/types'

// Replicating your typical system layout types
export type BackupRunStatus = 'success' | 'failed' | 'upload_failed'

export type BackupRunRow = {
  id: number
  filename: string
  size_bytes: number
  status: BackupRunStatus
  source: BackupSource
  remote_synced: boolean
  error_message: string | null
  created_at: Date
}

export type BackupRun = {
  id: number
  filename: string
  sizeBytes: number
  status: BackupRunStatus
  source: BackupSource
  remoteSynced: boolean
  errorMessage: string | null
  createdAt: Date
}

function mapRow(row: BackupRunRow): BackupRun {
  return {
    id: row.id,
    filename: row.filename,
    sizeBytes: Number(row.size_bytes),
    status: row.status,
    source: row.source,
    remoteSynced: Boolean(row.remote_synced),
    errorMessage: row.error_message,
    createdAt: row.created_at,
  }
}

export async function insertBackupRun(input: {
  filename: string
  sizeBytes: number
  status: BackupRunStatus
  source: BackupSource
  remoteSynced: boolean
  errorMessage?: string | null
}) {
  return withConnection(async (connection) => {
    const request = new sql.Request(connection)

    request.input('filename', sql.VarChar, input.filename)
    request.input('sizeBytes', sql.BigInt, input.sizeBytes)
    request.input('status', sql.VarChar, input.status)
    request.input('source', sql.VarChar, input.source)
    request.input('remoteSynced', sql.Bit, input.remoteSynced ? 1 : 0)
    request.input('errorMessage', sql.VarChar, input.errorMessage ?? null)

    const result: IResult<BackupRunRow> = await request.query(`
      INSERT INTO backup_runs (filename, size_bytes, status, source, remote_synced, error_message)
      OUTPUT 
        INSERTED.id, INSERTED.filename, INSERTED.size_bytes, INSERTED.status, 
        INSERTED.source, INSERTED.remote_synced, INSERTED.error_message, INSERTED.created_at
      VALUES (@filename, @sizeBytes, @status, @source, @remoteSynced, @errorMessage)
    `)

    return mapRow(result.recordset[0])
  })
}

export async function getBackupRunById(id: number): Promise<BackupRun | null> {
  return withConnection(async (connection) => {
    const request = new sql.Request(connection)
    request.input('id', sql.Int, id)

    const result: IResult<BackupRunRow> = await request.query(`
      SELECT TOP (1) id, filename, size_bytes, status, source, remote_synced, error_message, created_at
      FROM backup_runs
      WHERE id = @id
    `)

    const row = result.recordset[0]
    return row ? mapRow(row) : null
  })
}

export async function getLatestBackupRun(): Promise<BackupRun | null> {
  return withConnection(async (connection) => {
    const request = new sql.Request(connection)

    const result: IResult<BackupRunRow> = await request.query(`
      SELECT TOP (1) id, filename, size_bytes, status, source, remote_synced, error_message, created_at
      FROM backup_runs
      ORDER BY created_at DESC
    `)

    const row = result.recordset[0]
    return row ? mapRow(row) : null
  })
}

export async function getLatestSuccessfulBackupRun(): Promise<BackupRun | null> {
  return withConnection(async (connection) => {
    const request = new sql.Request(connection)

    const result: IResult<BackupRunRow> = await request.query(`
      SELECT TOP (1) id, filename, size_bytes, status, source, remote_synced, error_message, created_at
      FROM backup_runs
      WHERE status = 'success'
      ORDER BY created_at DESC
    `)

    const row = result.recordset[0]
    return row ? mapRow(row) : null
  })
}

export async function listBackupRuns(limit = 20): Promise<BackupRun[]> {
  return withConnection(async (connection) => {
    const request = new sql.Request(connection)
    request.input('limit', sql.Int, limit)

    const result: IResult<BackupRunRow> = await request.query(`
      SELECT TOP (@limit) id, filename, size_bytes, status, source, remote_synced, error_message, created_at
      FROM backup_runs
      ORDER BY created_at DESC
    `)

    return result.recordset.map(mapRow)
  })
}
