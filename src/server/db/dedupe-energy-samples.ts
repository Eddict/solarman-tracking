import sql from 'mssql'

import { isOnSampleBucketBoundary, normalizeToSampleBucket } from '@/lib/solarman/sample-timestamp'
import { withConnection } from '@/server/db/connection'
import type { EnergySampleRow } from '@/server/db/schema'

export type DedupeEnergySamplesResult = {
  groupsProcessed: number
  duplicatesRemoved: number
  timestampsNormalized: number
}

function bucketKey(stationId: number, recordedAt: Date) {
  return `${stationId}:${normalizeToSampleBucket(recordedAt).getTime()}`
}

function pickCanonicalRow(rows: EnergySampleRow[]) {
  return rows.find((row) => isOnSampleBucketBoundary(row.recorded_at))
    ?? rows.reduce((best, row) => row.id < best.id ? row : best)
}

export async function dedupeEnergySamples(stationId?: number): Promise<DedupeEnergySamplesResult> {
  return withConnection(async (connection) => {
    const request = connection.request()
    const whereClause = stationId === undefined ? '' : 'WHERE station_id = @station_id'

    if (stationId !== undefined) {
      request.input('station_id', sql.Int, stationId)
    }

    const result = await request.query<EnergySampleRow>(`SELECT id, station_id, recorded_at, production_w,
      consumption_w, battery_soc, battery_power_w, grid_import_w, grid_export_w, battery_charge_w,
      battery_discharge_w, irradiance FROM dbo.energy_samples_minute ${whereClause}
      ORDER BY station_id ASC, recorded_at ASC, id ASC`)
    const groups = new Map<string, EnergySampleRow[]>()

    for (const row of result.recordset) {
      const key = bucketKey(row.station_id, row.recorded_at)
      const group = groups.get(key) ?? []
      group.push(row)
      groups.set(key, group)
    }

    const transaction = new sql.Transaction(connection)
    await transaction.begin()
    let duplicatesRemoved = 0
    let timestampsNormalized = 0

    try {
      for (const group of groups.values()) {
        const canonical = pickCanonicalRow(group)
        const bucketAt = normalizeToSampleBucket(canonical.recorded_at)

        for (const duplicate of group) {
          if (duplicate.id !== canonical.id) {
            await transaction.request().input('id', sql.BigInt, duplicate.id)
              .query('DELETE FROM dbo.energy_samples_minute WHERE id = @id')
            duplicatesRemoved += 1
          }
        }

        if (canonical.recorded_at.getTime() !== bucketAt.getTime()) {
          await transaction.request().input('id', sql.BigInt, canonical.id)
            .input('recorded_at', sql.DateTime2(3), bucketAt)
            .query('UPDATE dbo.energy_samples_minute SET recorded_at = @recorded_at WHERE id = @id')
          timestampsNormalized += 1
        }
      }

      await transaction.commit()
      return { groupsProcessed: groups.size, duplicatesRemoved, timestampsNormalized }
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  })
}