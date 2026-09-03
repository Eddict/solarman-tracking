import sql from 'mssql'
import type { IResult } from 'mssql'

import type { AppConfig } from '@/lib/config/schema'
import { env } from '@/lib/env'
import { withConnection } from '@/server/db/connection'

export type BatteryAlertType = 'soc_low' | 'soc_high'

export type BatterySample = {
  batterySoc: number | null
  recordedAt: Date
}

export type BatteryAlert = {
  type: BatteryAlertType
  message: string
}

export function evaluateBatteryAlerts(
  sample: BatterySample,
  config: AppConfig,
): BatteryAlert[] {
  if (sample.batterySoc === null) {
    return []
  }

  const alerts: BatteryAlert[] = []
  const soc = sample.batterySoc
  const time = sample.recordedAt.toLocaleString(env.USE_LOCALE)

  if (soc <= config.battery.socLow) {
    alerts.push({
      type: 'soc_low',
      message: `⚠️ <b>Low battery</b>\nSOC: ${soc.toFixed(0)}% (threshold ${config.battery.socLow}%)\n${time}`,
    })
  }

  if (soc >= config.battery.socHigh) {
    alerts.push({
      type: 'soc_high',
      message: `✅ <b>Battery full</b>\nSOC: ${soc.toFixed(0)}% (threshold ${config.battery.socHigh}%)\n${time}`,
    })
  }

  return alerts
}

export async function wasAlertSentRecently(input: {
  alertType: BatteryAlertType
  stationId: number
  cooldownHours: number
}) {
  if (input.cooldownHours <= 0) {
    return false
  }

  return withConnection(async (connection) => {
    const request = new sql.Request(connection)

    request.input('alertType', sql.VarChar, input.alertType)
    request.input('stationId', sql.Int, input.stationId)
    request.input('cooldownHours', sql.Int, input.cooldownHours)

    // Using DATEADD and GETUTCDATE() to replicate UTC_TIMESTAMP interval math in MSSQL
    const result: IResult<{ total: number }> = await request.query(`
      SELECT COUNT(*) AS total
      FROM telegram_messages
      WHERE alert_type = @alertType 
        AND station_id = @stationId
        AND sent_at >= DATEADD(hour, -@cooldownHours, GETUTCDATE())
    `)

    return Number(result.recordset[0]?.total ?? 0) > 0
  })
}

export async function recordTelegramAlert(input: {
  alertType: BatteryAlertType
  stationId: number
  messageText: string
  sentAt: Date
}) {
  await withConnection(async (connection) => {
    const request = new sql.Request(connection)

    request.input('alertType', sql.VarChar, input.alertType)
    request.input('stationId', sql.Int, input.stationId)
    request.input('messageText', sql.NVarChar, input.messageText) // Use NVarChar to safely preserve emojis/HTML
    request.input('sentAt', sql.DateTime2, input.sentAt)

    await request.query(`
      INSERT INTO telegram_messages (alert_type, station_id, message_text, sent_at)
      VALUES (@alertType, @stationId, @messageText, @sentAt)
    `)
  })
}
