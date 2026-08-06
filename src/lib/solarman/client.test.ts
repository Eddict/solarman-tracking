import { describe, expect, it } from 'vitest'

import {
  hashPassword,
  kwhToWh,
  mapDailyEnergyItem,
  mapHistoryItemsToSamples,
  mapRealtimeToSample,
} from '@/lib/solarman/client'

describe('hashPassword', () => {
  it('preserves already hashed passwords', () => {
    const hashed = 'a'.repeat(64)
    expect(hashPassword(hashed)).toBe(hashed)
  })

  it('applies sha256 to plain-text passwords', () => {
    expect(hashPassword('test')).toBe(
      '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    )
  })
})

describe('mapRealtimeToSample', () => {
  it('maps realtime fields', () => {
    const sample = mapRealtimeToSample({
      stationId: 42,
      payload: {
        success: true,
        generationPower: 1200,
        usePower: 800,
        batterySoc: 55,
        batteryPower: 400,
        lastUpdateTime: 1_700_000_000,
      },
    })

    expect(sample).toMatchObject({
      stationId: 42,
      productionW: 1200,
      consumptionW: 800,
      batterySoc: 55,
      batteryPowerW: 400,
    })
    expect(sample?.recordedAt).toBeInstanceOf(Date)
  })

  it('maps grid and battery fields separately', () => {
    const sample = mapRealtimeToSample({
      stationId: 42,
      payload: {
        success: true,
        generationPower: 678,
        usePower: 678,
        purchasePower: -678,
        wirePower: -678,
        chargePower: -678,
        batterySoc: 56,
        batteryPower: -678,
        irradiateIntensity: 236.18,
        lastUpdateTime: 1_700_000_000,
      },
    })

    expect(sample).toMatchObject({
      gridImportW: 678,
      gridExportW: null,
      batteryChargeW: 678,
      batteryDischargeW: null,
      irradiance: 236.18,
    })
  })
})

describe('mapDailyEnergyItem', () => {
  it('maps daily totals to kWh', () => {
    const daily = mapDailyEnergyItem({
      year: 2019,
      month: 12,
      day: 23,
      generationValue: 1788,
      useValue: 1608,
      buyValue: 1608,
      gridValue: 0,
    })

    expect(daily).toEqual({
      date: '2019-12-23',
      producedKwh: 1788,
      consumedKwh: 1608,
      importedKwh: 1608,
      exportedKwh: 0,
    })
  })

  it('ignores lines without a date', () => {
    expect(mapDailyEnergyItem({ generationValue: 10 })).toBeNull()
  })
})

describe('kwhToWh', () => {
  it('converts kWh to Wh', () => {
    expect(kwhToWh(12.3)).toBe(12300)
    expect(kwhToWh(null)).toBe(0)
  })
})

describe('mapHistoryItemsToSamples', () => {
  it('uses dateTime when present', () => {
    const [sample] = mapHistoryItemsToSamples({
      stationId: 7,
      items: [
        {
          dateTime: '2024-06-01T10:15:00.000Z',
          generationPower: 500,
          usePower: 300,
          batterySoc: 40,
          batteryPower: 200,
          gridPower: 100,
          dischargePower: 50,
        },
      ],
    })

    expect(sample?.productionW).toBe(500)
    expect(sample?.gridExportW).toBe(100)
    expect(sample?.batteryDischargeW).toBe(50)
    expect(sample?.recordedAt.toISOString()).toBe('2024-06-01T10:15:00.000Z')
  })

  it('uses numeric dateTime as unix seconds', () => {
    const [sample] = mapHistoryItemsToSamples({
      stationId: 7,
      items: [
        {
          dateTime: 1782856800,
          generationPower: 500,
          usePower: 300,
          batterySoc: 40,
          batteryPower: 200,
        },
      ],
    })

    expect(sample?.recordedAt.toISOString()).toBe('2026-06-30T22:00:00.000Z')
  })

  it('normalizes realtime into the same frame bucket', () => {
    const sample = mapRealtimeToSample({
      stationId: 42,
      payload: {
        success: true,
        generationPower: 1200,
        usePower: 800,
        batterySoc: 55,
        batteryPower: 400,
        lastUpdateTime: 1_783_023_303,
      },
    })

    expect(sample?.recordedAt.toISOString()).toBe('2026-07-02T20:15:00.000Z')
  })

  it('ignores lines without a timestamp', () => {
    const samples = mapHistoryItemsToSamples({
      stationId: 7,
      items: [{ generationPower: 100 }],
    })

    expect(samples).toHaveLength(0)
  })
})
