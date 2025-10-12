import path from 'node:path'
import { fileURLToPath } from 'node:url'

const serverDir = globalThis.__dirname ?? path.dirname(fileURLToPath(import.meta.url))
const defaultRootDir = path.resolve(serverDir, '..')

function readEnv(key, { required = false, defaultValue, allowEmpty = false } = {}) {
  const rawValue = process.env[key]
  if (rawValue === undefined || rawValue === null) {
    if (defaultValue !== undefined) {
      return defaultValue
    }
    if (required) {
      throw new Error(`Environment variable ${key} is required`)
    }
    return undefined
  }

  const value = String(rawValue).trim()
  if (!allowEmpty && value.length === 0) {
    if (defaultValue !== undefined) {
      return defaultValue
    }
    if (required) {
      throw new Error(`Environment variable ${key} cannot be empty`)
    }
    return undefined
  }

  return value
}

function ensureRelativePath(value, key) {
  if (path.isAbsolute(value)) {
    throw new Error(`${key} must be a relative path inside the repository`)
  }

  const normalised = path.normalize(value)
  if (normalised.startsWith('..')) {
    throw new Error(`${key} must not traverse outside of the repository`)
  }

  return normalised
}

function parseInteger(value, key, { min, max, allowZero = true } = {}) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) {
    throw new Error(`${key} must be a valid integer`)
  }

  if (!allowZero && parsed === 0) {
    throw new Error(`${key} cannot be zero`)
  }

  if (min !== undefined && parsed < min) {
    throw new Error(`${key} must be >= ${min}`)
  }

  if (max !== undefined && parsed > max) {
    throw new Error(`${key} must be <= ${max}`)
  }

  return parsed
}

function normaliseUrl(value, key, { protocolWhitelist } = {}) {
  const trimmed = value.trim()
  try {
    const url = new URL(trimmed)
    if (protocolWhitelist && !protocolWhitelist.includes(url.protocol)) {
      throw new Error(`${key} must use one of the following protocols: ${protocolWhitelist.join(', ')}`)
    }
    return url.toString().replace(/\/$/, '')
  } catch (err) {
    if (trimmed.startsWith('/')) {
      return trimmed.replace(/\/$/, '')
    }
    throw new Error(`${key} must be a valid absolute URL or start with '/'`)
  }
}

function buildPublicEnv(overrides) {
  const publicEnvEntries = Object.entries(process.env)
    .filter(([key]) => key.startsWith('PUBLIC_'))
    .map(([key, value]) => [key, value === undefined || value === null ? '' : String(value)])

  const merged = { ...Object.fromEntries(publicEnvEntries), ...overrides }
  for (const key of Object.keys(merged)) {
    merged[key] = merged[key] ?? ''
    merged[key] = String(merged[key])
  }
  return Object.freeze(merged)
}

const ZONE_ID_PATTERN = /^[a-z0-9][a-z0-9-_]*$/i

function normaliseZoneId(value, index) {
  if (typeof value !== 'string') {
    throw new Error(`WORLD_ZONES[${index}].id must be a string`)
  }
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error(`WORLD_ZONES[${index}].id cannot be empty`)
  }
  if (!ZONE_ID_PATTERN.test(trimmed)) {
    throw new Error(
      `WORLD_ZONES[${index}].id must match ${ZONE_ID_PATTERN.toString()} (alphanumeric, hyphen, underscore)`
    )
  }
  return trimmed
}

function parseZoneConfig(rawValue, worldDir) {
  if (!rawValue) {
    return [
      Object.freeze({
        id: 'primary',
        label: 'Primary Zone',
        dataDir: worldDir,
        tickRate: null,
      }),
    ]
  }

  let parsed
  try {
    parsed = JSON.parse(rawValue)
  } catch (err) {
    parsed = rawValue
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .map(id => ({ id }))
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('WORLD_ZONES must be a JSON array or comma separated list with at least one entry')
  }

  const zones = []
  for (let index = 0; index < parsed.length; index++) {
    const descriptor = parsed[index]
    const zone = typeof descriptor === 'string' ? { id: descriptor } : descriptor
    if (!zone || typeof zone !== 'object') {
      throw new Error(`WORLD_ZONES[${index}] must be a string or object`)
    }

    const id = normaliseZoneId(zone.id ?? zone.slug ?? zone.name, index)
    const label = zone.label ? String(zone.label).trim() : id
    const relativeDataDir = ensureRelativePath(zone.dataDir ?? path.join('zones', id), `WORLD_ZONES[${index}].dataDir`)
    const dataDir = path.join(worldDir, relativeDataDir)

    let tickRate = null
    if (zone.tickRate !== undefined && zone.tickRate !== null && zone.tickRate !== '') {
      const numeric = Number(zone.tickRate)
      if (!Number.isFinite(numeric) || numeric <= 0) {
        throw new Error(`WORLD_ZONES[${index}].tickRate must be a positive number if provided`)
      }
      tickRate = numeric
    }

    zones.push(
      Object.freeze({
        id,
        label,
        dataDir,
        tickRate,
      })
    )
  }

  return zones
}

function buildServerConfig(options = {}) {
  const rootDir = options.rootDir ? path.resolve(options.rootDir) : defaultRootDir

  const worldName = ensureRelativePath(readEnv('WORLD', { required: true }), 'WORLD')
  const worldDir = path.join(rootDir, worldName)
  const assetsDir = path.join(worldDir, 'assets')
  const collectionsDir = path.join(worldDir, 'collections')

  const zoneConfig = parseZoneConfig(readEnv('WORLD_ZONES', { allowEmpty: true }), worldDir)

  const port = parseInteger(readEnv('PORT', { defaultValue: '3000' }), 'PORT', {
    min: 1,
    max: 65535,
  })

  const saveInterval = parseInteger(readEnv('SAVE_INTERVAL', { defaultValue: '60' }), 'SAVE_INTERVAL', {
    min: 0,
  })

  const jwtSecret = readEnv('JWT_SECRET', { required: true })

  const publicAssetsUrl = normaliseUrl(
    readEnv('PUBLIC_ASSETS_URL', { defaultValue: `http://localhost:${port}/assets` }),
    'PUBLIC_ASSETS_URL'
  )
  const publicApiUrl = normaliseUrl(
    readEnv('PUBLIC_API_URL', { defaultValue: `http://localhost:${port}/api` }),
    'PUBLIC_API_URL'
  )
  const publicWsUrl = normaliseUrl(
    readEnv('PUBLIC_WS_URL', { defaultValue: `ws://localhost:${port}/ws` }),
    'PUBLIC_WS_URL',
    { protocolWhitelist: ['ws:', 'wss:'] }
  )
  const publicMaxUploadSize = parseInteger(
    readEnv('PUBLIC_MAX_UPLOAD_SIZE', { defaultValue: '12' }),
    'PUBLIC_MAX_UPLOAD_SIZE',
    { min: 1 }
  )

  const adminCode = readEnv('ADMIN_CODE', { allowEmpty: true })
  const hasAdminCode = !!adminCode && adminCode.length > 0

  const commitHash = readEnv('COMMIT_HASH', { allowEmpty: true }) || null

  const livekit = {
    wsUrl: readEnv('LIVEKIT_WS_URL', { allowEmpty: true }) || null,
    apiKey: readEnv('LIVEKIT_API_KEY', { allowEmpty: true }) || null,
    apiSecret: readEnv('LIVEKIT_API_SECRET', { allowEmpty: true }) || null,
  }

  const publicEnv = buildPublicEnv({
    PUBLIC_ASSETS_URL: publicAssetsUrl,
    PUBLIC_API_URL: publicApiUrl,
    PUBLIC_WS_URL: publicWsUrl,
    PUBLIC_MAX_UPLOAD_SIZE: String(publicMaxUploadSize),
  })

  return Object.freeze({
    rootDir,
    world: Object.freeze({
      name: worldName,
      dir: worldDir,
      assetsDir,
      collectionsDir,
    }),
    server: Object.freeze({
      port,
      saveInterval,
      zones: Object.freeze(zoneConfig),
      defaultZoneId: zoneConfig[0].id,
    }),
    auth: Object.freeze({
      jwtSecret,
      adminCode: adminCode || null,
      hasAdminCode,
    }),
    public: Object.freeze({
      assetsUrl: publicAssetsUrl,
      apiUrl: publicApiUrl,
      wsUrl: publicWsUrl,
      maxUploadSize: publicMaxUploadSize,
      env: publicEnv,
    }),
    livekit: Object.freeze(livekit),
    commitHash,
  })
}

const serverConfig = buildServerConfig()

export function getServerConfig() {
  return serverConfig
}

export { serverConfig }
