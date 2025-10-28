import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs-extra'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..', '..')

describe('server runtime fastify app', () => {
  let runtime
  let worldRelativePath
  let worldDir

  beforeEach(async () => {
    vi.resetModules()

    worldRelativePath = path.posix.join('tmp', `test-world-${Date.now()}-${Math.random().toString(16).slice(2)}`)
    process.env.WORLD = worldRelativePath
    process.env.JWT_SECRET = 'integration-secret'
    process.env.PUBLIC_ASSETS_URL = 'http://localhost:3200/assets'
    process.env.PUBLIC_API_URL = 'http://localhost:3200/api'
    process.env.PUBLIC_WS_URL = 'ws://localhost:3200/ws'
    process.env.ADMIN_CODE = ''
    process.env.COMMIT_HASH = 'test-commit'

    await import('ses')
    await import('../../src/core/lockdown.js')

    const { createServerConfig } = await import('../../src/server/config.js')
    const config = createServerConfig()
    worldDir = config.world.dir
    const { createServerApp } = await import('../../src/server/runtime/createServerApp.js')
    runtime = await createServerApp({
      config,
      fastifyOptions: { logger: false },
    })
    await runtime.fastify.ready()
    await new Promise(resolve => setTimeout(resolve, 120))
  })

  afterEach(async () => {
    if (runtime) {
      await runtime.close()
      runtime = null
    }
    if (worldDir) {
      await fs.remove(worldDir)
      worldDir = null
    }
    if (worldRelativePath) {
      await fs.remove(path.join(repoRoot, worldRelativePath))
      worldRelativePath = null
    }
    delete process.env.WORLD
    delete process.env.JWT_SECRET
    delete process.env.PUBLIC_ASSETS_URL
    delete process.env.PUBLIC_API_URL
    delete process.env.PUBLIC_WS_URL
    delete process.env.ADMIN_CODE
    delete process.env.COMMIT_HASH
  })

  it('provides health, zones, metrics and status snapshots', async () => {
    const healthResponse = await runtime.fastify.inject({ method: 'GET', url: '/health' })
    expect(healthResponse.statusCode).toBe(200)
    const health = healthResponse.json()
    expect(health.status).toBe('ok')
    expect(Array.isArray(health.zones)).toBe(true)
    expect(health.zones.length).toBeGreaterThan(0)

    const zonesResponse = await runtime.fastify.inject({ method: 'GET', url: '/zones' })
    expect(zonesResponse.statusCode).toBe(200)
    const zones = zonesResponse.json()
    expect(zones.count).toBeGreaterThan(0)
    expect(zones.defaultZoneId).toBeTruthy()
    expect(zones.zones[0].id).toBe(zones.defaultZoneId)

    const metricsResponse = await runtime.fastify.inject({ method: 'GET', url: '/metrics' })
    expect(metricsResponse.statusCode).toBe(200)
    const metrics = metricsResponse.json()
    expect(Array.isArray(metrics.zones)).toBe(true)
    expect(metrics.zones.length).toBe(zones.count)
    for (const zone of metrics.zones) {
      expect(zone.id).toBeTruthy()
      expect(zone.ticks).toHaveProperty('expectedRate')
      expect(zone).toHaveProperty('issues')
    }

    const statusResponse = await runtime.fastify.inject({ method: 'GET', url: '/status' })
    expect(statusResponse.statusCode).toBe(200)
    const status = statusResponse.json()
    expect(status.commitHash).toBe('test-commit')
    expect(Array.isArray(status.zones)).toBe(true)
    expect(status.zones.length).toBe(zones.count)
  })
})

