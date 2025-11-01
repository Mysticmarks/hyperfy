import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function setBaseEnv() {
  process.env.WORLD = 'world'
  process.env.JWT_SECRET = 'secret'
  for (const key of ['PUBLIC_ASSETS_URL', 'PUBLIC_API_URL', 'PUBLIC_WS_URL']) {
    delete process.env[key]
  }
  delete process.env.WORLD_ZONES
}

describe('server config zone parsing', () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    for (const key of Object.keys(process.env)) {
      delete process.env[key]
    }
    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
      if (value !== undefined) {
        process.env[key] = value
      }
    }
    setBaseEnv()
  })

  afterEach(() => {
    vi.resetModules()
    for (const key of Object.keys(process.env)) {
      delete process.env[key]
    }
    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
      if (value !== undefined) {
        process.env[key] = value
      }
    }
  })

  it('honours maxCatchUpTicks in WORLD_ZONES definitions', async () => {
    process.env.WORLD_ZONES = JSON.stringify([
      { id: 'alpha', tickRate: 20, maxCatchUpTicks: 3 },
      { id: 'beta', maxCatchUpTicks: 0 },
    ])

    const { createServerConfig } = await import('../../src/server/config.js')
    const config = createServerConfig({ rootDir: process.cwd() })

    expect(config.server.zones[0].maxCatchUpTicks).toBe(3)
    expect(config.server.zones[1].maxCatchUpTicks).toBe(0)
  })

  it('rejects negative maxCatchUpTicks values', async () => {
    process.env.WORLD_ZONES = JSON.stringify([{ id: 'gamma', maxCatchUpTicks: -1 }])

    await expect(async () => {
      const { createServerConfig } = await import('../../src/server/config.js')
      createServerConfig({ rootDir: process.cwd() })
    }).rejects.toThrow(/maxCatchUpTicks/)
  })
})
