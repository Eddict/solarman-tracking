#!/usr/bin/env tsx

import sql from 'mssql'
import type { IResult } from 'mssql'

import { dumpDatabase, restoreDatabase } from '@/features/backup/service'
import { closePool, withConnection } from '@/server/db/connection'

type Baseline = {
  sampleCount: number
  configCount: number
  maxRecordedAt: string | null
}

const SENTINEL_DATE = '2099-01-01 00:00:00.000'

async function readBaseline(): Promise<Baseline> {
  return withConnection(async (connection) => {
    const request = new sql.Request(connection)
    
    const sampleResult: IResult<{ total: number; maxAt: Date | null }> = await request.query(`
      SELECT COUNT(*) AS total, MAX(recorded_at) AS maxAt 
      FROM energy_samples_minute
    `)
    
    const configRequest = new sql.Request(connection)
    const configResult: IResult<{ total: number }> = await configRequest.query(`
      SELECT COUNT(*) AS total 
      FROM app_config
    `)

    // Extracting row 0 explicitly from the recordsets
    const sample = sampleResult.recordset[0]
    const config = configResult.recordset[0]

    return {
      sampleCount: Number(sample?.total ?? 0),
      configCount: Number(config?.total ?? 0),
      maxRecordedAt: sample?.maxAt ? new Date(sample.maxAt).toISOString() : null,
    }
  })
}

async function insertSentinel(stationId: number) {
  await withConnection(async (connection) => {
    const request = new sql.Request(connection)

    request.input('stationId', sql.Int, stationId)
    request.input('sentinelDate', sql.DateTime2, SENTINEL_DATE)

    await request.query(`
      INSERT INTO energy_samples_minute
        (station_id, recorded_at, production_w, consumption_w)
      VALUES (@stationId, @sentinelDate, -1, -1)
    `)
  })
}

async function countSentinel() {
  return withConnection(async (connection) => {
    const request = new sql.Request(connection)
    request.input('sentinelDate', sql.DateTime2, SENTINEL_DATE)

    const result: IResult<{ total: number }> = await request.query(`
      SELECT COUNT(*) AS total 
      FROM energy_samples_minute 
      WHERE recorded_at = @sentinelDate
    `)

    // Added index [0]
    return Number(result.recordset[0]?.total ?? 0)
  })
}

async function getAnyStationId() {
  return withConnection(async (connection) => {
    const request = new sql.Request(connection)

    const result: IResult<{ station_id: number }> = await request.query(`
      SELECT TOP (1) station_id 
      FROM energy_samples_minute 
      ORDER BY recorded_at DESC
    `)

    // Added index [0]
    if (result.recordset[0]?.station_id) {
      return Number(result.recordset[0].station_id)
    }

    return 1
  })
}

function assertEqual(label: string, actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`${label}: atteso ${String(expected)}, ottenuto ${String(actual)}`)
  }
}

async function main() {
  console.log('[restore-test] baseline...')
  const baseline = await readBaseline()
  const stationId = await getAnyStationId()

  console.log('[restore-test] dump...')
  const dump = await dumpDatabase()

  console.log('[restore-test] sentinel insert...')
  await insertSentinel(stationId)

  const sentinelBefore = await countSentinel()
  assertEqual('sentinel prima del restore', sentinelBefore, 1)

  console.log('[restore-test] restore...')
  await restoreDatabase(dump.filePath)

  const sentinelAfter = await countSentinel()
  assertEqual('sentinel dopo il restore', sentinelAfter, 0)

  const after = await readBaseline()
  assertEqual('sample count', after.sampleCount, baseline.sampleCount)
  assertEqual('config count', after.configCount, baseline.configCount)
  assertEqual('max recorded_at', after.maxRecordedAt, baseline.maxRecordedAt)

  console.log('[restore-test] OK')
  await closePool()
}

main().catch(async (error) => {
  console.error('[restore-test] errore:', error)
  await closePool()
  process.exit(1)
})
