import { createNodeClientWorld } from './build/world-node-client.js'

const DEFAULT_CONFIG = {
  wsUrl: 'ws://localhost:3000/ws',
  name: undefined,
  avatar: undefined,
  movementEnabled: true,
  moveMode: 'wander',
  wanderKeys: ['keyW', 'keyA', 'keyS', 'keyD', 'space', 'shiftLeft'],
  wanderIntervalMs: 350,
  wanderPressProbability: 0.6,
  wanderMaxActive: 2,
  chatEnabled: true,
  chatMessage: 'heyo...',
  chatDelayMs: 2000,
  chatRepeatMs: 0,
  autoReconnect: true,
  reconnectDelayMs: 2000,
  verbose: true,
}

const config = buildConfig()
const log = createLogger(config.verbose)
let world
let sessionCleanup
let reconnectTimer
let shuttingDown = false

start()

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

function start() {
  clearTimeout(reconnectTimer)
  world = createWorld()
  log('connecting to world', config.wsUrl)
  world.init(filterUndefined({
    wsUrl: config.wsUrl,
    name: config.name,
    avatar: config.avatar,
  }))
}

function createWorld() {
  const instance = createNodeClientWorld()

  instance.once('ready', () => {
    log('world ready')
    sessionCleanup = startSession(instance)
  })

  instance.on('kick', payload => {
    log('kicked from world', payload?.reason ?? '')
    teardownSession(instance)
    scheduleReconnect()
  })

  instance.on('disconnect', payload => {
    log('disconnected from world', payload?.reason ?? '')
    teardownSession(instance)
    scheduleReconnect()
  })

  instance.on('error', error => {
    console.error('[agent:error]', error)
  })

  return instance
}

function startSession(instance) {
  const cleanups = []

  if (config.movementEnabled && config.moveMode !== 'idle') {
    if (config.moveMode === 'wander') {
      cleanups.push(startWanderMovement(instance))
    } else {
      log('unknown move mode, skipping movement control:', config.moveMode)
    }
  }

  if (config.chatEnabled && config.chatMessage) {
    cleanups.push(startChat(instance))
  }

  log('session started', {
    movement: config.movementEnabled ? config.moveMode : 'disabled',
    chat: config.chatEnabled && config.chatMessage ? 'enabled' : 'disabled',
  })

  return () => {
    cleanups.forEach(stop => stop?.())
  }
}

function startWanderMovement(instance) {
  const keys = Array.isArray(config.wanderKeys) ? config.wanderKeys.filter(Boolean) : []
  if (keys.length === 0) {
    log('no keys configured for wander movement, skipping')
    return () => {}
  }

  const pressed = new Map(keys.map(key => [key, false]))
  const activeKeys = new Set()
  const maxActive = Math.max(0, Math.floor(config.wanderMaxActive ?? 0))
  const intervalMs = Math.max(50, Math.floor(config.wanderIntervalMs ?? DEFAULT_CONFIG.wanderIntervalMs))
  const pressProbability = clamp(config.wanderPressProbability ?? DEFAULT_CONFIG.wanderPressProbability, 0, 1)
  let timerId

  log('movement:wander config', {
    intervalMs,
    pressProbability,
    maxActive: maxActive || 'unbounded',
    keys,
  })

  function tick() {
    const key = choose(keys)
    const shouldPress = Math.random() < pressProbability
    if (shouldPress) {
      requestPress(key)
    } else {
      requestRelease(key)
    }
    timerId = setTimeout(tick, intervalMs)
  }

  function requestPress(key) {
    if (pressed.get(key)) return
    if (maxActive > 0 && activeKeys.size >= maxActive) {
      const victim = choose(Array.from(activeKeys))
      if (victim) {
        applyState(victim, false)
      }
    }
    applyState(key, true)
  }

  function requestRelease(key) {
    if (!pressed.get(key)) return
    applyState(key, false)
  }

  function applyState(key, nextState) {
    const current = pressed.get(key)
    if (current === nextState) return
    pressed.set(key, nextState)
    if (nextState) {
      activeKeys.add(key)
    } else {
      activeKeys.delete(key)
    }
    instance.controls.simulateButton(key, nextState)
    log('movement', nextState ? 'press' : 'release', key)
  }

  tick()

  return () => {
    clearTimeout(timerId)
    keys.forEach(key => applyState(key, false))
    activeKeys.clear()
  }
}

function startChat(instance) {
  const delay = Math.max(0, Math.floor(config.chatDelayMs ?? DEFAULT_CONFIG.chatDelayMs))
  const repeat = Math.max(0, Math.floor(config.chatRepeatMs ?? 0))
  const message = config.chatMessage
  let timerId

  log('chat config', {
    message,
    delay,
    repeat,
  })

  function sendMessage() {
    instance.chat.send(message)
    log('chat sent', message)
    if (repeat > 0) {
      timerId = setTimeout(sendMessage, repeat)
    }
  }

  timerId = setTimeout(sendMessage, delay)

  return () => {
    clearTimeout(timerId)
  }
}

function scheduleReconnect() {
  if (!config.autoReconnect) {
    log('auto reconnect disabled, shutting down')
    shutdown()
    return
  }
  if (shuttingDown) return
  if (reconnectTimer) return
  log('scheduling reconnect in', config.reconnectDelayMs, 'ms')
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    teardownWorld()
    if (!shuttingDown) {
      start()
    }
  }, Math.max(1000, Math.floor(config.reconnectDelayMs ?? DEFAULT_CONFIG.reconnectDelayMs)))
}

function teardownSession(instance) {
  sessionCleanup?.()
  sessionCleanup = null
  try {
    instance.controls?.reset?.()
  } catch (error) {
    log('failed to reset controls', error?.message ?? error)
  }
  try {
    instance.destroy?.()
  } catch (error) {
    log('failed to destroy world instance', error?.message ?? error)
  }
}

function teardownWorld() {
  if (world) {
    try {
      world.destroy?.()
    } catch (error) {
      log('failed to destroy world during teardown', error?.message ?? error)
    }
    world = null
  }
}

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  log('shutting down agent')
  clearTimeout(reconnectTimer)
  reconnectTimer = null
  sessionCleanup?.()
  sessionCleanup = null
  teardownWorld()
  process.exit(0)
}

function buildConfig() {
  const envConfig = {
    wsUrl: process.env.HYPERFY_AGENT_WS_URL,
    name: process.env.HYPERFY_AGENT_NAME,
    avatar: process.env.HYPERFY_AGENT_AVATAR,
    movementEnabled: parseBoolean(process.env.HYPERFY_AGENT_MOVE_ENABLED),
    moveMode: process.env.HYPERFY_AGENT_MOVE_MODE,
    wanderKeys: parseList(process.env.HYPERFY_AGENT_WANDER_KEYS),
    wanderIntervalMs: parseNumber(process.env.HYPERFY_AGENT_WANDER_INTERVAL_MS),
    wanderPressProbability: parseNumber(process.env.HYPERFY_AGENT_WANDER_PRESS_PROBABILITY),
    wanderMaxActive: parseNumber(process.env.HYPERFY_AGENT_WANDER_MAX_ACTIVE),
    chatEnabled: parseBoolean(process.env.HYPERFY_AGENT_CHAT_ENABLED),
    chatMessage: process.env.HYPERFY_AGENT_CHAT_MESSAGE,
    chatDelayMs: parseNumber(process.env.HYPERFY_AGENT_CHAT_DELAY_MS),
    chatRepeatMs: parseNumber(process.env.HYPERFY_AGENT_CHAT_REPEAT_MS),
    autoReconnect: parseBoolean(process.env.HYPERFY_AGENT_AUTO_RECONNECT),
    reconnectDelayMs: parseNumber(process.env.HYPERFY_AGENT_RECONNECT_DELAY_MS),
    verbose: parseBoolean(process.env.HYPERFY_AGENT_VERBOSE),
  }

  const args = parseArgs(process.argv.slice(2))
  const cliConfig = {}

  if ('wsUrl' in args) cliConfig.wsUrl = args.wsUrl
  if ('name' in args) cliConfig.name = args.name
  if ('avatar' in args) cliConfig.avatar = args.avatar
  if ('moveMode' in args) cliConfig.moveMode = args.moveMode
  if ('wanderKeys' in args) cliConfig.wanderKeys = parseList(args.wanderKeys)
  if ('keys' in args) cliConfig.wanderKeys = parseList(args.keys)
  if ('wanderIntervalMs' in args) cliConfig.wanderIntervalMs = parseNumber(args.wanderIntervalMs)
  if ('interval' in args) cliConfig.wanderIntervalMs = parseNumber(args.interval)
  if ('wanderPressProbability' in args) cliConfig.wanderPressProbability = parseNumber(args.wanderPressProbability)
  if ('pressProbability' in args) cliConfig.wanderPressProbability = parseNumber(args.pressProbability)
  if ('wanderMaxActive' in args) cliConfig.wanderMaxActive = parseNumber(args.wanderMaxActive)
  if ('maxActive' in args) cliConfig.wanderMaxActive = parseNumber(args.maxActive)
  if ('chatMessage' in args) cliConfig.chatMessage = args.chatMessage
  if ('chatDelayMs' in args) cliConfig.chatDelayMs = parseNumber(args.chatDelayMs)
  if ('chatDelay' in args) cliConfig.chatDelayMs = parseNumber(args.chatDelay)
  if ('chatRepeatMs' in args) cliConfig.chatRepeatMs = parseNumber(args.chatRepeatMs)
  if ('chatRepeat' in args) cliConfig.chatRepeatMs = parseNumber(args.chatRepeat)
  if ('reconnectDelayMs' in args) cliConfig.reconnectDelayMs = parseNumber(args.reconnectDelayMs)
  if ('reconnectDelay' in args) cliConfig.reconnectDelayMs = parseNumber(args.reconnectDelay)

  if ('move' in args) cliConfig.movementEnabled = resolveBoolean(args.move)
  if ('chat' in args) cliConfig.chatEnabled = resolveBoolean(args.chat)
  if ('autoReconnect' in args) cliConfig.autoReconnect = resolveBoolean(args.autoReconnect)
  if ('verbose' in args) cliConfig.verbose = resolveBoolean(args.verbose)
  if ('silent' in args) cliConfig.verbose = !resolveBoolean(args.silent)

  const merged = {
    ...DEFAULT_CONFIG,
    ...filterUndefined(envConfig),
    ...filterUndefined(cliConfig),
  }

  if (!merged.movementEnabled) {
    merged.moveMode = 'idle'
  }

  if (!merged.chatEnabled) {
    merged.chatMessage = ''
  }

  merged.wanderKeys = Array.isArray(merged.wanderKeys)
    ? merged.wanderKeys.map(value => String(value).trim()).filter(Boolean)
    : DEFAULT_CONFIG.wanderKeys.slice()

  return merged
}

function parseArgs(tokens) {
  const result = {}
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (!token.startsWith('--')) continue
    const withoutPrefix = token.slice(2)
    if (withoutPrefix.startsWith('no-')) {
      const key = toCamelCase(withoutPrefix.slice(3))
      result[key] = false
      continue
    }
    const eqIndex = withoutPrefix.indexOf('=')
    if (eqIndex !== -1) {
      const key = toCamelCase(withoutPrefix.slice(0, eqIndex))
      const value = withoutPrefix.slice(eqIndex + 1)
      result[key] = value
      continue
    }
    const key = toCamelCase(withoutPrefix)
    const next = tokens[index + 1]
    if (!next || next.startsWith('--')) {
      result[key] = true
    } else {
      result[key] = next
      index += 1
    }
  }
  return result
}

function resolveBoolean(value) {
  if (typeof value === 'boolean') return value
  const normalized = parseBoolean(value)
  if (typeof normalized === 'boolean') return normalized
  return true
}

function parseBoolean(value) {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'boolean') return value
  const normalized = String(value).trim().toLowerCase()
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false
  return undefined
}

function parseNumber(value) {
  if (value === undefined || value === null || value === '') return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function parseList(value) {
  if (!value) return undefined
  if (Array.isArray(value)) return value
  return String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function clamp(value, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return min
  return Math.min(Math.max(number, min), max)
}

function choose(list) {
  if (!Array.isArray(list) || list.length === 0) return undefined
  const index = Math.floor(Math.random() * list.length)
  return list[index]
}

function filterUndefined(object) {
  return Object.fromEntries(
    Object.entries(object || {}).filter(([, value]) => value !== undefined)
  )
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
}

function createLogger(enabled) {
  if (!enabled) return () => {}
  return (...args) => {
    const timestamp = new Date().toISOString()
    console.log(`[agent ${timestamp}]`, ...args)
  }
}
