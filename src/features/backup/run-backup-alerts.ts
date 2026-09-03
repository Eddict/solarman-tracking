import sql from 'mssql'
import type { IResult } from 'mssql'

import { getConfig } from '@/lib/config/service'
import { sendTelegramMessage } from '@/lib/telegram/notifier'
import { getBackupHealth } from '@/features/backup/service'
import { withConnection } from '@/server/db/connection'
import { getStationId } from '@/server/jobs/sync-solarman'

export type BackupAlertRunResult = {
  sent: number
  skipped: number
  errors: string[]
}

async function wasAlertSentRecently(input: {
  alertType: string
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

    // Using DATEADD and GETUTCDATE() for MSSQL compatible date math
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

async function recordTelegramAlert(input: {
  alertType: string
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

export async function runBackupAlerts(): Promise<BackupAlertRunResult> {
  const config = await getConfig()

  if (!config.telegram.enabled || !config.backup.alertOnMissing) {
    return { sent: 0, skipped: 0, errors: [] }
  }

  const health = await getBackupHealth()

  if (health.status !== 'missing') {
    return { sent: 0, skipped: 0, errors: [] }
  }

  const stationId = getStationId()
  const recentlySent = await wasAlertSentRecently({
    alertType: 'backup_missing',
    stationId,
    cooldownHours: config.battery.alertCooldownHours,
  })

  if (recentlySent) {
    return { sent: 0, skipped: 1, errors: [] }
  }

  const hoursText =
    health.hoursSinceLastSuccess === null
      ? 'no backup recorded'
      : `${health.hoursSinceLastSuccess.toFixed(1)} hours ago`

  const message = `⚠️ <b>Backup missing</b>\nLast successful backup: ${hoursText}\nThreshold: ${health.maxAgeHours} hours`

  const result = await sendTelegramMessage(message)

  if (!result.ok) {
    return { sent: 0, skipped: 0, errors: [result.error ?? 'Unknown error'] }
  }

  await recordTelegramAlert({
    alertType: 'backup_missing',
    stationId,
    messageText: message,
    sentAt: new Date(),
  })

  return { sent: 1, skipped: 0, errors: [] }
}
