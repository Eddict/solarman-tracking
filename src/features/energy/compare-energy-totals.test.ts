import { describe, expect, it } from 'vitest'

import {
  assessDayCoverage,
  buildDateRange,
  computeDeltaPct,
  dailyEnergyToWh,
  exceedsTolerance,
  expectedSamplesForDay,
  type CompareEnergyTotalsResult,
} from '@/features/energy/server/compare-energy-totals'

describe('buildDateRange', () => {
  it('returns the last N days in chronological order', () => {
    const now = new Date('2026-07-06T15:00:00.000Z')
    expect(buildDateRange(3, now)).toEqual(['2026-07-04', '2026-07-05', '2026-07-06'])
  })
})

describe('expectedSamplesForDay', () => {
  it('uses 288 samples for complete days', () => {
    const now = new Date('2026-07-06T15:00:00.000Z')
    expect(expectedSamplesForDay('2026-07-05', now)).toBe(288)
  })

  it('scales the expected samples for the current day', () => {
    const now = new Date('2026-07-06T01:10:00.000Z')
    expect(expectedSamplesForDay('2026-07-06', now)).toBe(14)
  })
})

describe('assessDayCoverage', () => {
  it('considers coverage sufficient above 80%', () => {
    const now = new Date('2026-07-06T15:00:00.000Z')
    const coverage = assessDayCoverage('2026-07-05', 240, now)

    expect(coverage.expectedSamples).toBe(288)
    expect(coverage.sufficient).toBe(true)
  })

  it('requires backfill below the threshold', () => {
    const now = new Date('2026-07-06T15:00:00.000Z')
    const coverage = assessDayCoverage('2026-07-05', 100, now)

    expect(coverage.sufficient).toBe(false)
  })
})

describe('computeDeltaPct', () => {
  it('calculates the percentage difference', () => {
    expect(computeDeltaPct(1050, 1000)).toBeCloseTo(5)
    expect(computeDeltaPct(0, 0)).toBe(0)
    expect(computeDeltaPct(100, 0)).toBeNull()
  })
})

describe('dailyEnergyToWh', () => {
  it('converts daily totals to Wh', () => {
    expect(
      dailyEnergyToWh({
        producedKwh: 12.3,
        consumedKwh: 8.1,
        importedKwh: 1.2,
        exportedKwh: 4.5,
      }),
    ).toEqual({
      producedWh: 12300,
      consumedWh: 8100,
      importedWh: 1200,
      exportedWh: 4500,
    })
  })
})

describe('exceedsTolerance', () => {
  it('detects deltas beyond tolerance', () => {
    const result: CompareEnergyTotalsResult = {
      days: [
        {
          date: '2026-07-05',
          sampleCount: 288,
          expectedSamples: 288,
          minute: {
            producedWh: 11000,
            consumedWh: 8000,
            importedWh: 1000,
            exportedWh: 2000,
          },
          api: {
            producedWh: 10000,
            consumedWh: 8000,
            importedWh: 1000,
            exportedWh: 2000,
          },
          deltaPct: {
            produced: 10,
            consumed: 0,
            imported: 0,
            exported: 0,
          },
        },
      ],
      backfillRan: false,
      backfillInserted: 0,
      weekMinute: {
        producedWh: 11000,
        consumedWh: 8000,
        importedWh: 1000,
        exportedWh: 2000,
        selfConsumedWh: 9000,
      },
      weekApi: {
        producedWh: 10000,
        consumedWh: 8000,
        importedWh: 1000,
        exportedWh: 2000,
        selfConsumedWh: 8000,
      },
    }

    expect(exceedsTolerance(result)).toBe(true)
  })

  it('ignores days without API data', () => {
    const result: CompareEnergyTotalsResult = {
      days: [
        {
          date: '2026-07-05',
          sampleCount: 288,
          expectedSamples: 288,
          minute: {
            producedWh: 11000,
            consumedWh: 8000,
            importedWh: 1000,
            exportedWh: 2000,
          },
          api: null,
          deltaPct: {
            produced: null,
            consumed: null,
            imported: null,
            exported: null,
          },
        },
      ],
      backfillRan: false,
      backfillInserted: 0,
      weekMinute: {
        producedWh: 11000,
        consumedWh: 8000,
        importedWh: 1000,
        exportedWh: 2000,
        selfConsumedWh: 9000,
      },
      weekApi: {
        producedWh: 0,
        consumedWh: 0,
        importedWh: 0,
        exportedWh: 0,
        selfConsumedWh: 0,
      },
    }

    expect(exceedsTolerance(result)).toBe(false)
  })
})
