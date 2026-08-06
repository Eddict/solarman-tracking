#!/usr/bin/env tsx

import { closePool } from '@/server/db/connection'
import {
  compareEnergyTotals,
  DEFAULT_COMPARE_DAYS,
  DELTA_TOLERANCE_PCT,
  exceedsTolerance,
  type CompareEnergyTotalsResult,
  type DayComparison,
  type DayDeltaPct,
} from '@/features/energy/server/compare-energy-totals'

const days = Number(process.argv[2] ?? DEFAULT_COMPARE_DAYS)

async function main() {
  const result = await compareEnergyTotals({ days })
  printReport(result)

  if (exceedsTolerance(result)) {
    console.error(
      `\n[compare:totals] At least one metric exceeds the ${DELTA_TOLERANCE_PCT}% tolerance`,
    )
    process.exitCode = 1
  }

  await closePool()
}

function printReport(result: CompareEnergyTotalsResult) {
  console.log('[compare:totals] Energy comparison: minute samples vs Solarman daily API\n')

  for (const day of result.days) {
    printDay(day)
    console.log('')
  }

  printWeekTotals(result)
  printBackfillSummary(result)
}

function printDay(day: DayComparison) {
  const samples = `${day.sampleCount}/${day.expectedSamples}`
  console.log(`Data: ${day.date}  Campioni: ${samples}`)

  if (!day.api) {
    console.log('  API: no daily data available')
    printMetricRow('  Production', day.minute.producedWh, null, null)
    printMetricRow('  Consumption', day.minute.consumedWh, null, null)
    printMetricRow('  Grid import', day.minute.importedWh, null, null)
    printMetricRow('  Grid export', day.minute.exportedWh, null, null)
    return
  }

  printMetricRow('  Production', day.minute.producedWh, day.api.producedWh, day.deltaPct.produced)
  printMetricRow('  Consumption', day.minute.consumedWh, day.api.consumedWh, day.deltaPct.consumed)
  printMetricRow('  Grid import', day.minute.importedWh, day.api.importedWh, day.deltaPct.imported)
  printMetricRow('  Grid export', day.minute.exportedWh, day.api.exportedWh, day.deltaPct.exported)
}

function printWeekTotals(result: CompareEnergyTotalsResult) {
  console.log('Period total')
  printMetricRow(
    '  Production',
    result.weekMinute.producedWh,
    result.weekApi.producedWh,
    computeWeekDelta(result.weekMinute.producedWh, result.weekApi.producedWh),
  )
  printMetricRow(
    '  Consumption',
    result.weekMinute.consumedWh,
    result.weekApi.consumedWh,
    computeWeekDelta(result.weekMinute.consumedWh, result.weekApi.consumedWh),
  )
  printMetricRow(
    '  Grid import',
    result.weekMinute.importedWh,
    result.weekApi.importedWh,
    computeWeekDelta(result.weekMinute.importedWh, result.weekApi.importedWh),
  )
  printMetricRow(
    '  Grid export',
    result.weekMinute.exportedWh,
    result.weekApi.exportedWh,
    computeWeekDelta(result.weekMinute.exportedWh, result.weekApi.exportedWh),
  )
}

function printBackfillSummary(result: CompareEnergyTotalsResult) {
  if (!result.backfillRan) {
    console.log('\nBackfill: not needed')
    return
  }

  console.log(`\nBackfill: eseguito (${result.backfillInserted} lines inserite/aggiornate)`)
}

function printMetricRow(
  label: string,
  minuteWh: number,
  apiWh: number | null,
  deltaPct: number | null,
) {
  const minute = formatEnergy(minuteWh)
  const api = apiWh === null ? '—' : formatEnergy(apiWh)
  const delta = formatDelta(deltaPct)

  console.log(`${label.padEnd(18)} ${minute.padStart(10)}  ${api.padStart(10)}  ${delta}`)
}

function computeWeekDelta(minuteWh: number, apiWh: number) {
  if (apiWh === 0) {
    if (minuteWh === 0) {
      return 0
    }

    return null
  }

  return ((minuteWh - apiWh) / apiWh) * 100
}

function formatEnergy(wh: number) {
  if (wh >= 1000) {
    return `${(wh / 1000).toFixed(1)} kWh`
  }

  return `${Math.round(wh)} Wh`
}

function formatDelta(deltaPct: DayDeltaPct[keyof DayDeltaPct]) {
  if (deltaPct === null) {
    return '—'
  }

  const sign = deltaPct > 0 ? '+' : ''
  return `${sign}${deltaPct.toFixed(1)}%`
}

main().catch(async (error) => {
  console.error('[compare:totals] errore:', error)
  await closePool()
  process.exit(1)
})
