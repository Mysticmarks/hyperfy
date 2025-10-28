import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import Fastify from 'fastify'
import ws from '@fastify/websocket'
import cors from '@fastify/cors'
import compress from '@fastify/compress'
import statics from '@fastify/static'
import multipart from '@fastify/multipart'

import { createServerWorld } from '../../core/createServerWorld'
import { hashFile } from '../../core/utils-server'
import { getDB } from '../db'
import { Storage } from '../Storage'
import { initCollections } from '../collections'
import { getServerConfig } from '../config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function cloneCollections(data) {
  if (typeof structuredClone === 'function') {
    return structuredClone(data)
  }
  return JSON.parse(JSON.stringify(data))
}

async function resolveFirstExisting(paths, description) {
  for (const candidate of paths) {
    if (await fs.pathExists(candidate)) {
      return candidate
    }
  }
  throw new Error(`Unable to locate ${description}: checked ${paths.join(', ')}`)
}

export async function createServerApp({
  config: providedConfig,
  fastifyFactory = Fastify,
  fastifyOptions = {},
} = {}) {
  const config = providedConfig ?? getServerConfig()
  const {
    rootDir,
    world: { dir: worldDir, assetsDir, collectionsDir },
    server: { zones: configuredZones, defaultZoneId },
    public: publicConfig,
    auth,
    commitHash,
  } = config

  await fs.ensureDir(worldDir)
  await fs.ensureDir(assetsDir)
  await fs.ensureDir(collectionsDir)

  const builtInAssetsDir = await resolveFirstExisting(
    [
      path.join(rootDir, 'world/assets'),
      path.join(rootDir, 'src/world/assets'),
      path.join(rootDir, '../world/assets'),
      path.join(rootDir, '../src/world/assets'),
    ],
    'built-in assets directory'
  )
  const builtInCollectionsDir = await resolveFirstExisting(
    [
      path.join(rootDir, 'world/collections'),
      path.join(rootDir, 'src/world/collections'),
      path.join(rootDir, '../world/collections'),
      path.join(rootDir, '../src/world/collections'),
    ],
    'built-in collections directory'
  )

  await fs.copy(builtInAssetsDir, assetsDir)
  await fs.copy(builtInCollectionsDir, collectionsDir)

  const baseCollections = await initCollections({ collectionsDir, assetsDir })

  const zones = new Map()
  for (const zoneConfig of configuredZones) {
    await fs.ensureDir(zoneConfig.dataDir)
    const db = await getDB(zoneConfig.dataDir, { assetsRootDir: worldDir })
    const storage = new Storage(path.join(zoneConfig.dataDir, '/storage.json'))
    const world = createServerWorld()
    world.zoneId = zoneConfig.id
    world.zoneLabel = zoneConfig.label
    if (zoneConfig.tickRate) {
      world.networkRate = 1 / zoneConfig.tickRate
      world.serverTickRate = zoneConfig.tickRate
    }
    world.assetsUrl = publicConfig.assetsUrl
    world.collections.deserialize(cloneCollections(baseCollections))
    await world.init({ db, storage, assetsDir })
    zones.set(zoneConfig.id, {
      world,
      db,
      storage,
      config: zoneConfig,
    })
  }

  if (!zones.size) {
    throw new Error('No zones could be initialised')
  }

  const defaultZone = zones.get(defaultZoneId)
  if (!defaultZone) {
    throw new Error(`Default zone "${defaultZoneId}" is not available`)
  }

  function resolveZone(zoneId) {
    if (zoneId && zones.has(zoneId)) {
      return zones.get(zoneId)
    }
    return defaultZone
  }

  function getDefaultWorld() {
    return resolveZone(defaultZoneId).world
  }

  function getZoneSnapshots() {
    const snapshots = []
    for (const [zoneId, zone] of zones) {
      const world = zone.world
      const sockets = []
      for (const socket of world.network.sockets.values()) {
        sockets.push({
          id: socket.player?.data?.userId ?? null,
          name: socket.player?.data?.name ?? null,
          position: socket.player?.position?.value?.toArray?.() ?? null,
        })
      }
      snapshots.push({
        id: zoneId,
        label: zone.config.label,
        tickRate: zone.config.tickRate,
        networkRate: world.networkRate,
        frame: world.frame,
        time: world.time,
        sockets,
      })
    }
    return snapshots
  }

  const fastify = fastifyFactory({ logger: { level: 'error' }, ...fastifyOptions })

  fastify.register(cors)
  fastify.register(compress)
  fastify.get('/', async (req, reply) => {
    const world = getDefaultWorld()
    const title = world.settings.title || 'World'
    const desc = world.settings.desc || ''
    const image = world.resolveURL(world.settings.image?.url) || ''
    const url = publicConfig.assetsUrl
    const filePath = path.join(__dirname, '../public/index.html')
    let html = fs.readFileSync(filePath, 'utf-8')
    html = html.replaceAll('{url}', url)
    html = html.replaceAll('{title}', title)
    html = html.replaceAll('{desc}', desc)
    html = html.replaceAll('{image}', image)
    reply.type('text/html').send(html)
  })
  fastify.register(statics, {
    root: path.join(__dirname, '../public'),
    prefix: '/',
    decorateReply: false,
    setHeaders: res => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
    },
  })
  fastify.register(statics, {
    root: assetsDir,
    prefix: '/assets/',
    decorateReply: false,
    setHeaders: res => {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString())
    },
  })
  fastify.register(multipart, {
    limits: {
      fileSize: 200 * 1024 * 1024,
    },
  })
  fastify.register(ws)
  fastify.register(async instance => {
    instance.get('/ws', { websocket: true }, (socket, req) => {
      const baseQuery = { ...(req.query ?? {}) }
      const requestedZone = Array.isArray(baseQuery.zone)
        ? baseQuery.zone[0]
        : typeof baseQuery.zone === 'string'
          ? baseQuery.zone
          : undefined
      const zone = resolveZone(requestedZone)
      if (!zone) {
        socket.close(1008, 'Zone unavailable')
        return
      }
      baseQuery.zone = zone.config.id
      zone.world.network.onConnection(socket, baseQuery)
    })
  })

  const publicEnvs = publicConfig.env
  const envsCode = `
  if (!globalThis.env) globalThis.env = {}
  globalThis.env = ${JSON.stringify(publicEnvs)}
`
  fastify.get('/env.js', async (req, reply) => {
    reply.type('application/javascript').send(envsCode)
  })

  fastify.post('/api/upload', async (req, reply) => {
    const file = await req.file()
    const ext = file.filename.split('.').pop().toLowerCase()
    const chunks = []
    for await (const chunk of file.file) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)
    const hash = await hashFile(buffer)
    const filename = `${hash}.${ext}`
    const filePath = path.join(assetsDir, filename)
    const exists = await fs.exists(filePath)
    if (!exists) {
      await fs.writeFile(filePath, buffer)
    }
  })

  fastify.get('/api/upload-check', async (req, reply) => {
    const filename = req.query.filename
    const filePath = path.join(assetsDir, filename)
    const exists = await fs.exists(filePath)
    return { exists }
  })

  fastify.get('/api/zones/:zoneId/characters/:userId', async (req, reply) => {
    const { zoneId, userId } = req.params
    const zone = resolveZone(zoneId)
    if (!zone) {
      reply.code(404)
      return { error: 'Zone not found' }
    }
    const character = await zone.world.characters.getCharacterByUserId(userId, { create: false })
    if (!character) {
      reply.code(404)
      return { error: 'Character not found' }
    }
    return { character: zone.world.characters.serializeForClient(character) }
  })

  fastify.post('/api/zones/:zoneId/characters/:userId', async (req, reply) => {
    const { zoneId, userId } = req.params
    const zone = resolveZone(zoneId)
    if (!zone) {
      reply.code(404)
      return { error: 'Zone not found' }
    }
    const payload = req.body ?? {}
    const character = await zone.world.characters.getCharacterByUserId(userId, {
      create: true,
      name: payload.name,
      spawn: payload.spawn ?? zone.world.network.spawn,
    })
    if (payload?.name) {
      await zone.world.characters.updateCharacterName(character.id, payload.name)
    }
    return { character: zone.world.characters.serializeForClient(character) }
  })

  fastify.post('/api/zones/:zoneId/characters/:characterId/inventory', async (req, reply) => {
    const { zoneId, characterId } = req.params
    const zone = resolveZone(zoneId)
    if (!zone) {
      reply.code(404)
      return { error: 'Zone not found' }
    }
    const item = await zone.world.characters.upsertInventoryItem(characterId, req.body ?? {})
    if (!item) {
      reply.code(400)
      return { error: 'Invalid inventory payload' }
    }
    return { item }
  })

  fastify.delete('/api/zones/:zoneId/characters/:characterId/inventory/:itemId', async (req, reply) => {
    const { zoneId, characterId, itemId } = req.params
    const zone = resolveZone(zoneId)
    if (!zone) {
      reply.code(404)
      return { error: 'Zone not found' }
    }
    const rawSlot = req.query?.slot
    const slot = rawSlot === undefined || rawSlot === null || rawSlot === 'null' || rawSlot === 'undefined' ? null : rawSlot
    await zone.world.characters.removeInventoryItem(characterId, itemId, slot)
    return { success: true }
  })

  fastify.post('/api/zones/:zoneId/characters/:characterId/quests', async (req, reply) => {
    const { zoneId, characterId } = req.params
    const zone = resolveZone(zoneId)
    if (!zone) {
      reply.code(404)
      return { error: 'Zone not found' }
    }
    const quest = await zone.world.characters.upsertQuestState(characterId, req.body?.questId, req.body ?? {})
    if (!quest) {
      reply.code(400)
      return { error: 'Invalid quest payload' }
    }
    return { quest }
  })

  fastify.delete('/api/zones/:zoneId/characters/:characterId/quests/:questId', async (req, reply) => {
    const { zoneId, characterId, questId } = req.params
    const zone = resolveZone(zoneId)
    if (!zone) {
      reply.code(404)
      return { error: 'Zone not found' }
    }
    await zone.world.characters.removeQuest(characterId, questId)
    return { success: true }
  })

  fastify.get('/health', async (request, reply) => {
    try {
      const snapshots = getZoneSnapshots()
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        zones: snapshots.map(snapshot => ({
          id: snapshot.id,
          label: snapshot.label,
          players: snapshot.sockets.length,
          frame: snapshot.frame,
          time: snapshot.time,
        })),
      }

      return reply.code(200).send(health)
    } catch (error) {
      console.error('Health check failed:', error)
      return reply.code(503).send({
        status: 'error',
        timestamp: new Date().toISOString(),
      })
    }
  })

  fastify.get('/zones', async (request, reply) => {
    try {
      const snapshots = getZoneSnapshots()
      return reply.code(200).send({
        defaultZoneId,
        count: snapshots.length,
        zones: snapshots.map(snapshot => ({
          id: snapshot.id,
          label: snapshot.label,
          tickRate: snapshot.tickRate,
          networkRate: snapshot.networkRate,
          players: snapshot.sockets.length,
          frame: snapshot.frame,
          time: snapshot.time,
        })),
      })
    } catch (error) {
      console.error('Zones endpoint failed:', error)
      return reply.code(503).send({
        status: 'error',
        timestamp: new Date().toISOString(),
      })
    }
  })

  fastify.get('/metrics', async (request, reply) => {
    try {
      const zoneMetrics = await Promise.all(
        Array.from(zones.entries()).map(async ([zoneId, zone]) => {
          const stats = await zone.world.monitor.getStats()
          const expectedTickRate = (() => {
            const candidate = zone.config.tickRate ?? zone.world.serverTickRate
            if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
              return candidate
            }
            return 30
          })()

          const issues = []
          if (stats.ticks.sampleCount > 0) {
            if (stats.ticks.observedRate > 0 && stats.ticks.observedRate < expectedTickRate * 0.9) {
              issues.push('tick-rate-degraded')
            }
            const frameBudgetMs = 1000 / expectedTickRate
            if (stats.ticks.maxDurationMs > frameBudgetMs * 2) {
              issues.push('tick-duration-spike')
            }
          }
          if (stats.eventLoop?.p99Ms && stats.eventLoop.p99Ms > 50) {
            issues.push('event-loop-lag')
          }
          if (stats.currentCPU > stats.maxCPU * 0.9) {
            issues.push('cpu-saturation')
          }
          if (stats.currentMemory > stats.maxMemory * 0.9) {
            issues.push('memory-pressure')
          }

          return {
            id: zoneId,
            label: zone.config.label,
            players: zone.world.network.sockets.size,
            frame: zone.world.frame,
            time: zone.world.time,
            networkRate: zone.world.networkRate,
            cpu: stats.currentCPU,
            maxCPU: stats.maxCPU,
            memory: stats.currentMemory,
            maxMemory: stats.maxMemory,
            ticks: {
              expectedRate: expectedTickRate,
              sampleCount: stats.ticks.sampleCount,
              windowMs: stats.ticks.windowMs,
              observedRate: stats.ticks.observedRate,
              averageDurationMs: stats.ticks.averageDurationMs,
              maxDurationMs: stats.ticks.maxDurationMs,
              averageDeltaMs: stats.ticks.averageDeltaMs,
            },
            eventLoop: stats.eventLoop,
            issues,
          }
        })
      )

      return reply.code(200).send({
        timestamp: new Date().toISOString(),
        zones: zoneMetrics,
      })
    } catch (error) {
      console.error('Metrics endpoint failed:', error)
      return reply.code(503).send({
        status: 'error',
        timestamp: new Date().toISOString(),
      })
    }
  })

  fastify.get('/status', async (request, reply) => {
    try {
      const snapshots = getZoneSnapshots()
      const defaultSnapshot = snapshots.find(snapshot => snapshot.id === defaultZoneId)
      const status = {
        uptime: Math.round(getDefaultWorld().time),
        protected: auth.hasAdminCode,
        connectedUsers: defaultSnapshot ? defaultSnapshot.sockets : [],
        commitHash,
        zones: snapshots.map(snapshot => ({
          id: snapshot.id,
          label: snapshot.label,
          tickRate: snapshot.tickRate,
          networkRate: snapshot.networkRate,
          frame: snapshot.frame,
          time: snapshot.time,
          players: snapshot.sockets.length,
          connectedUsers: snapshot.sockets,
        })),
      }

      return reply.code(200).send(status)
    } catch (error) {
      console.error('Status failed:', error)
      return reply.code(503).send({
        status: 'error',
        timestamp: new Date().toISOString(),
      })
    }
  })

  fastify.setErrorHandler((err, req, reply) => {
    console.error(err)
    reply.status(500).send()
  })

  async function close() {
    try {
      await fastify.close()
    } finally {
      for (const zone of zones.values()) {
        try {
          zone.world?.destroy?.()
        } catch (err) {
          console.error('Failed to destroy world', err)
        }
        try {
          await zone.storage?.persist?.()
        } catch (err) {
          console.error('Failed to persist storage', err)
        }
        try {
          await zone.db?.close?.()
        } catch (err) {
          console.error('Failed to close database', err)
        }
      }
    }
  }

  return {
    fastify,
    config,
    zones,
    resolveZone,
    getZoneSnapshots,
    envsCode,
    close,
  }
}

