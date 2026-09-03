import { describe, expect, it } from 'vitest'

import { envSchema } from '@/lib/env'

describe('envSchema', () => {
  it('applies MSSQL defaults in local dev', () => {
    const parsed = envSchema.parse({})

    expect(parsed.MSSQL_SERVER).toBe('127.0.0.1')
    expect(parsed.MSSQL_DATABASE).toBe('solar_tracking')
    expect(parsed.USE_LOCALE).toBe('en-US')
    expect(parsed.NODE_ENV).toBe('development')
  })

  it('accepts Docker overrides with mssql server', () => {
    const parsed = envSchema.parse({
      MSSQL_SERVER: 'mssql',
      MSSQL_USER: 'solartracking',
      MSSQL_PASSWORD: 'solartracking_pwd',
      MSSQL_DATABASE: 'solar_tracking',
    })

    expect(parsed.MSSQL_SERVER).toBe('mssql')
  })

  it('rejects an invalid Solarman email', () => {
    expect(() =>
      envSchema.parse({ SOLARMAN_EMAIL: 'not-an-email' }),
    ).toThrow()
  })
})
