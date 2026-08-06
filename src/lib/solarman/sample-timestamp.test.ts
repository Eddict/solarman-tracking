import { describe, expect, it } from 'vitest'

import {
  isOnSampleBucketBoundary,
  normalizeToSampleBucket,
} from '@/lib/solarman/sample-timestamp'

describe('normalizeToSampleBucket', () => {
  it('aligns to the 5-minute bucket', () => {
    const frame = new Date('2026-07-02T20:15:00.000Z')
    const realtime = new Date('2026-07-02T20:15:03.000Z')

    expect(normalizeToSampleBucket(frame)).toEqual(frame)
    expect(normalizeToSampleBucket(realtime)).toEqual(frame)
  })

  it('collapses realtime and frame into the same bucket', () => {
    const frame = new Date('2026-07-03T04:55:00.000Z')
    const realtimeA = new Date('2026-07-03T04:55:38.000Z')
    const realtimeB = new Date('2026-07-03T04:55:39.000Z')

    expect(normalizeToSampleBucket(realtimeA).getTime()).toBe(frame.getTime())
    expect(normalizeToSampleBucket(realtimeB).getTime()).toBe(frame.getTime())
  })
})

describe('isOnSampleBucketBoundary', () => {
  it('detects timestamps already aligned', () => {
    const aligned = new Date('2026-07-02T20:20:00.000Z')
    const shifted = new Date('2026-07-02T20:20:05.000Z')

    expect(isOnSampleBucketBoundary(aligned)).toBe(true)
    expect(isOnSampleBucketBoundary(shifted)).toBe(false)
  })
})
