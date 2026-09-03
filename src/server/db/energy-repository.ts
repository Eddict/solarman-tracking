import sql from 'mssql'

import { normalizeToSampleBucket } from '@/lib/solarman/sample-timestamp'
import { withConnection } from '@/server/db/connection'
import type {
  EnergySampleInsert,
  EnergySampleRow,
  SyncStateRow,
  SyncStatus,
} from '@/server/db/schema'

const SAMPLE_INPUTS = `
  @station_id, @recorded_at, @production_w, @consumption_w, @battery_soc, @battery_power_w,
  @grid_import_w, @grid_export_w, @battery_charge_w, @battery_discharge_w, @irradiance
`

const SAMPLE_COLUMNS = `
  station_id, recorded_at, production_w, consumption_w, battery_soc, battery_power_w,
  grid_import_w, grid_export_w, battery_charge_w, battery_discharge_w, irradiance
`

export async function upsertEnergySamples(samples: EnergySampleInsert[]) {
  if (samples.length === 0) {
    return 0
  }

  const deduped = dedupeSamplesByBucket(samples)

  return withConnection(async (connection) => {
    const transaction = new sql.Transaction(connection)
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE)

    try {
      for (const sample of deduped) {
        const request = addSampleInputs(transaction.request(), sample)
        await request.query(`
          UPDATE dbo.energy_samples_minute
          SET production_w = @production_w, consumption_w = @consumption_w,
              battery_soc = @battery_soc, battery_power_w = @battery_power_w,
              grid_import_w = @grid_import_w, grid_export_w = @grid_export_w,
              battery_charge_w = @battery_charge_w, battery_discharge_w = @battery_discharge_w,
              irradiance = @irradiance
          WHERE station_id = @station_id AND recorded_at = @recorded_at;

          IF @@ROWCOUNT = 0
            INSERT INTO dbo.energy_samples_minute (${SAMPLE_COLUMNS})
            VALUES (${SAMPLE_INPUTS});
        `)
      }

      await transaction.commit()
      return deduped.length
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  })
}

function addSampleInputs(request: sql.Request, sample: EnergySampleInsert) {
  return request
    .input('station_id', sql.Int, sample.stationId)
    .input('recorded_at', sql.DateTime2(3), sample.recordedAt)
    .input('production_w', sql.Decimal(12, 2), sample.productionW)
    .input('consumption_w', sql.Decimal(12, 2), sample.consumptionW)
    .input('battery_soc', sql.Decimal(5, 2), sample.batterySoc)
    .input('battery_power_w', sql.Decimal(12, 2), sample.batteryPowerW)
    .input('grid_import_w', sql.Decimal(12, 2), sample.gridImportW)
    .input('grid_export_w', sql.Decimal(12, 2), sample.gridExportW)
    .input('battery_charge_w', sql.Decimal(12, 2), sample.batteryChargeW)
    .input('battery_discharge_w', sql.Decimal(12, 2), sample.batteryDischargeW)
    .input('irradiance', sql.Decimal(12, 2), sample.irradiance)
}

function dedupeSamplesByBucket(samples: EnergySampleInsert[]) {
  const byKey = new Map<string, EnergySampleInsert>()

  for (const sample of samples) {
    const recordedAt = normalizeToSampleBucket(sample.recordedAt)
    const key = `${sample.stationId}:${recordedAt.getTime()}`
    byKey.set(key, { ...sample, recordedAt })
  }

  return [...byKey.values()]
}

export async function saveRawPayload(input: {
  source: string
  stationId: number
  fetchedAt: Date
  payload: unknown
}) {
  await withConnection(async (connection) => {
    await connection.request()
      .input('source', sql.VarChar(32), input.source)
      .input('station_id', sql.Int, input.stationId)
      .input('fetched_at', sql.DateTime2(3), input.fetchedAt)
      .input('payload', sql.NVarChar(sql.MAX), JSON.stringify(input.payload))
      .query(`INSERT INTO dbo.energy_samples_raw (source, station_id, fetched_at, payload)
              VALUES (@source, @station_id, @fetched_at, @payload)`)
  })
}

export async function countEnergySamplesByDay(input: { stationId: number; from: Date; to: Date }) {
  return withConnection(async (connection) => {
    const result = await connection.request()
      .input('station_id', sql.Int, input.stationId)
      .input('from', sql.DateTime2(3), input.from)
      .input('to', sql.DateTime2(3), input.to)
      .query<{ day: Date; total: number }>(`
        SELECT CAST(recorded_at AS date) AS day, COUNT(*) AS total
        FROM dbo.energy_samples_minute
        WHERE station_id = @station_id AND recorded_at >= @from AND recorded_at <= @to
        GROUP BY CAST(recorded_at AS date)
        ORDER BY day ASC
      `)

    return result.recordset.map((row) => ({ day: formatSqlDate(row.day), count: Number(row.total) }))
  })
}

function formatSqlDate(value: Date | string) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10)
}

export async function getEnergySamples(input: { stationId: number; from: Date; to: Date }) {
  return withConnection(async (connection) => {
    const result = await connection.request()
      .input('station_id', sql.Int, input.stationId)
      .input('from', sql.DateTime2(3), input.from)
      .input('to', sql.DateTime2(3), input.to)
      .query<EnergySampleRow>(`SELECT id, ${SAMPLE_COLUMNS}
        FROM dbo.energy_samples_minute
        WHERE station_id = @station_id AND recorded_at >= @from AND recorded_at <= @to
        ORDER BY recorded_at ASC`)

    return result.recordset
  })
}

export async function getFirstSampleDate(stationId: number) {
  return withConnection(async (connection) => {
    const result = await connection.request().input('station_id', sql.Int, stationId)
      .query<{ first_at: Date | null }>(`SELECT MIN(recorded_at) AS first_at
        FROM dbo.energy_samples_minute WHERE station_id = @station_id`)
    return result.recordset[0]?.first_at ?? null
  })
}

export async function countEnergySamples(stationId: number) {
  return withConnection(async (connection) => {
    const result = await connection.request().input('station_id', sql.Int, stationId)
      .query<{ total: number }>('SELECT COUNT(*) AS total FROM dbo.energy_samples_minute WHERE station_id = @station_id')
    return Number(result.recordset[0]?.total ?? 0)
  })
}

export async function getSyncState(jobName: string) {
  return withConnection(async (connection) => {
    const result = await connection.request().input('job_name', sql.VarChar(64), jobName)
      .query<SyncStateRow>(`SELECT job_name, watermark_at, last_run_at, last_status, last_error
        FROM dbo.sync_state WHERE job_name = @job_name`)
    return result.recordset[0] ?? null
  })
}

export async function updateSyncState(input: {
  jobName: string
  watermarkAt?: Date | null
  lastRunAt: Date
  lastStatus: SyncStatus
  lastError?: string | null
}) {
  await withConnection(async (connection) => {
    await connection.request()
      .input('job_name', sql.VarChar(64), input.jobName)
      .input('watermark_at', sql.DateTime2(3), input.watermarkAt ?? null)
      .input('last_run_at', sql.DateTime2(3), input.lastRunAt)
      .input('last_status', sql.VarChar(16), input.lastStatus)
      .input('last_error', sql.NVarChar(sql.MAX), input.lastError ?? null)
      .query(`UPDATE dbo.sync_state
              SET watermark_at = COALESCE(@watermark_at, watermark_at), last_run_at = @last_run_at,
                  last_status = @last_status, last_error = @last_error
              WHERE job_name = @job_name;
              IF @@ROWCOUNT = 0
                INSERT INTO dbo.sync_state (job_name, watermark_at, last_run_at, last_status, last_error)
                VALUES (@job_name, @watermark_at, @last_run_at, @last_status, @last_error);`)
  })
}