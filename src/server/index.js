import 'ses'
import '../core/lockdown'
import './bootstrap'

import fs from 'fs-extra'
import path from 'path'
import Fastify from 'fastify'
import ws from '@fastify/websocket'
import cors from '@fastify/cors'
import compress from '@fastify/compress'
import statics from '@fastify/static'
import multipart from '@fastify/multipart'

import { createServerWorld } from '../core/createServerWorld'
import { hashFile } from '../core/utils-server'
import { getDB } from './db'
import { Storage } from './Storage'
import { initCollections } from './collections'
import { getServerConfig } from './config.js'

function cloneCollections(data) {
  if (typeof structuredClone === 'function') {
    return structuredClone(data)
  }
  return JSON.parse(JSON.stringify(data))
}

const config = getServerConfig()
const {
  rootDir,
  world: { dir: worldDir, assetsDir, collectionsDir },
  server: { port, zones: configuredZones, defaultZoneId },
  public: publicConfig,
  auth,
  commitHash,
} = config

// create world folders if needed
await fs.ensureDir(worldDir)
await fs.ensureDir(assetsDir)
await fs.ensureDir(collectionsDir)

// copy over built-in assets and collections
await fs.copy(path.join(rootDir, 'src/world/assets'), path.join(assetsDir))
await fs.copy(path.join(rootDir, 'src/world/collections'), path.join(collectionsDir))

// init collections shared by all zones
const baseCollections = await initCollections({ collectionsDir, assetsDir })

// boot each configured zone with isolated persistence but shared assets
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
  world.init({ db, storage, assetsDir })
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

const fastify = Fastify({ logger: { level: 'error' } })

fastify.register(cors)
fastify.register(compress)
fastify.get('/', async (req, reply) => {
  const world = getDefaultWorld()
  const title = world.settings.title || 'World'
  const desc = world.settings.desc || ''
  const image = world.resolveURL(world.settings.image?.url) || ''
  const url = publicConfig.assetsUrl
  const filePath = path.join(__dirname, 'public', 'index.html')
  let html = fs.readFileSync(filePath, 'utf-8')
  html = html.replaceAll('{url}', url)
  html = html.replaceAll('{title}', title)
  html = html.replaceAll('{desc}', desc)
  html = html.replaceAll('{image}', image)
  reply.type('text/html').send(html)
})
fastify.register(statics, {
  root: path.join(__dirname, 'public'),
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
    // all assets are hashed & immutable so we can use aggressive caching
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable') // 1 year
    res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString()) // older browsers
  },
})
fastify.register(multipart, {
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB
  },
})
fastify.register(ws)
fastify.register(worldNetwork)

const publicEnvs = publicConfig.env
const envsCode = `
  if (!globalThis.env) globalThis.env = {}
  globalThis.env = ${JSON.stringify(publicEnvs)}
`
fastify.get('/env.js', async (req, reply) => {
  reply.type('application/javascript').send(envsCode)
})

fastify.post('/api/upload', async (req, reply) => {
  // console.log('DEBUG: slow uploads')
  // await new Promise(resolve => setTimeout(resolve, 2000))
  const file = await req.file()
  const ext = file.filename.split('.').pop().toLowerCase()
  // create temp buffer to store contents
  const chunks = []
  for await (const chunk of file.file) {
    chunks.push(chunk)
  }
  const buffer = Buffer.concat(chunks)
  // hash from buffer
  const hash = await hashFile(buffer)
  const filename = `${hash}.${ext}`
  // save to fs
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
    const metrics = []
    for (const [zoneId, zone] of zones) {
      const stats = await zone.world.monitor.getStats()
      metrics.push({
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
      })
    }

    return reply.code(200).send({
      timestamp: new Date().toISOString(),
      zones: metrics,
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

try {
  await fastify.listen({ port, host: '0.0.0.0' })
} catch (err) {
  console.error(err)
  console.error(`failed to launch on port ${port}`)
  process.exit(1)
}

async function worldNetwork(fastify) {
  fastify.get('/ws', { websocket: true }, (ws, req) => {
    const baseQuery = { ...(req.query ?? {}) }
    const requestedZone = Array.isArray(baseQuery.zone)
      ? baseQuery.zone[0]
      : typeof baseQuery.zone === 'string'
        ? baseQuery.zone
        : undefined
    const zone = resolveZone(requestedZone)
    if (!zone) {
      ws.close(1008, 'Zone unavailable')
      return
    }
    baseQuery.zone = zone.config.id
    zone.world.network.onConnection(ws, baseQuery)
  })
}

console.info(`running on port ${port}`)

// Graceful shutdown
process.on('SIGINT', async () => {
  await fastify.close()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await fastify.close()
  process.exit(0)
})
