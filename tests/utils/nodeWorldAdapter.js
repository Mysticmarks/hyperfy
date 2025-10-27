import { EventEmitter } from 'node:events'
import { installRuntimeEnvironment } from './runtimeEnvironment.js'
import { createLatencyInjector } from './latencyHarness.js'
import { loadCaptureFixture } from './captureFixture.js'

installRuntimeEnvironment()

const THREE = await import('three')
const { ClientControls } = await import('../../src/core/systems/ClientControls.js')
const { Chat } = await import('../../src/core/systems/Chat.js')

export function createAgentWorldAdapter({ fixture: fixtureInput, latencyProfile, scheduler } = {}) {
  installRuntimeEnvironment()

  const fixture = loadCaptureFixture(fixtureInput || 'agent-wander')
  const telemetry = {
    controls: [],
    chat: [],
    resets: 0,
    destroys: 0,
    networkPackets: [],
    playerChat: [],
    physics: fixture.physics ? fixture.physics.slice() : [],
    animation: fixture.animation ? fixture.animation.slice() : [],
  }

  const timers = new Set()
  const world = new ThinWorld(telemetry)
  world.rig = new THREE.Object3D()
  world.camera = new THREE.PerspectiveCamera(70, 0, 0.2, 1200)
  world.chat = new Chat(world)

  const controlsSystem = new ClientControls(world)
  controlsSystem.start()
  world.controls = controlsSystem

  const adapter = new AgentWorldAdapter({
    world,
    controlsSystem,
    chatSystem: world.chat,
    fixture,
    telemetry,
    timers,
    latencyProfile: latencyProfile || fixture.latency || {},
    scheduler,
  })

  return adapter
}

class ThinWorld extends EventEmitter {
  constructor(telemetry) {
    super()
    this.events = new EventEmitter()
    this.telemetry = telemetry
    this.ui = {
      shouldAllowTabNavigation: () => false,
      suppressReticle: () => () => {},
    }
    this.prefs = {
      stats: false,
      setStats: () => {},
    }
    this.entities = {
      player: {
        data: { id: 'player-fixture', name: 'FixtureAgent' },
        chat: message => {
          telemetry.playerChat.push(message)
        },
      },
      get: () => undefined,
      getPlayer: id => (id === 'player-fixture' ? this.entities.player : undefined),
      deserialize: () => {},
      add: () => {},
      remove: () => {},
      modify: () => {},
    }
    this.network = {
      isClient: true,
      id: 'player-fixture',
      send: (name, payload) => {
        telemetry.networkPackets.push({ name, payload })
      },
    }
    this.collections = { deserialize: () => {} }
    this.settings = { deserialize: () => {}, setHasAdminCode: () => {} }
    this.blueprints = { deserialize: () => {}, add: () => {}, modify: () => {} }
    this.companions = { deserialize: () => {} }
    this.mounts = { deserialize: () => {} }
    this.livekit = { deserialize: () => {} }
    this.loader = { preload: () => {}, execPreload: () => {} }
  }
}

class AgentWorldAdapter extends EventEmitter {
  constructor({ world, controlsSystem, chatSystem, fixture, telemetry, timers, latencyProfile, scheduler }) {
    super()
    this.world = world
    this.controlsSystem = controlsSystem
    this.chatSystem = chatSystem
    this.fixture = fixture
    this.telemetry = telemetry
    this.timers = timers
    this.pending = 0
    this.completedResolvers = []
    this.readyResolvers = []
    this.hasReady = false
    this.scheduler = typeof scheduler === 'function' ? scheduler : null
    this.initCalls = []

    this.latency = createLatencyInjector(latencyProfile || {}, (callback, delay) => this.scheduleTask(callback, delay))

    this.controls = {
      simulateButton: (key, pressed) => {
        this.telemetry.controls.push({ key, state: pressed ? 'press' : 'release' })
        this.controlsSystem.simulateButton(key, pressed)
      },
      reset: () => {
        this.telemetry.resets += 1
        this.controlsSystem.releaseAllButtons()
      },
    }

    this.chat = {
      send: message => {
        this.telemetry.chat.push({ message })
        return this.chatSystem.send(message)
      },
    }
  }

  init(options = {}) {
    this.initCalls.push({ ...options })
    this.scheduleReady()
    if (this.fixture?.meta?.autoplayEvents) {
      this.scheduleEvents()
    }
  }

  scheduleTask(callback, delay) {
    const timer = (this.scheduler || defaultScheduler)(() => {
      this.timers.delete(timer)
      callback()
    }, delay)
    this.timers.add(timer)
    return timer
  }

  scheduleReady() {
    const handshake = () => {
      this.emit('livekit-connected', this.fixture.handshake?.livekit || {})
    }
    const ready = () => {
      this.hasReady = true
      this.emit('ready')
      for (const resolve of this.readyResolvers) {
        resolve()
      }
      this.readyResolvers = []
    }
    this.addPending()
    this.latency.schedule('network', () => {
      handshake()
      this.resolvePending()
    })
    this.addPending()
    this.latency.schedule('network', () => {
      ready()
      this.resolvePending()
    })
  }

  scheduleEvents() {
    const events = Array.isArray(this.fixture.events) ? this.fixture.events : []
    for (const event of events) {
      this.addPending()
      this.latency.schedule(event.channel || 'timeline', () => {
        this.applyEvent(event)
        this.resolvePending()
      }, Number.isFinite(event.at) ? event.at : 0)
    }
  }

  applyEvent(event) {
    if (event.type === 'controls') {
      this.controls.simulateButton(event.key, event.state === 'press')
      return
    }
    if (event.type === 'chat') {
      this.chat.send(event.message)
      return
    }
    if (event.type === 'disconnect') {
      this.emit('disconnect', { reason: event.reason || 'fixture-disconnect' })
    }
  }

  getPhysicsFrame(index) {
    return this.telemetry.physics[index]
  }

  getAnimationFrame(index) {
    return this.telemetry.animation[index]
  }

  waitForReady() {
    if (this.hasReady) return Promise.resolve()
    return new Promise(resolve => this.readyResolvers.push(resolve))
  }

  untilIdle() {
    if (this.pending === 0) return Promise.resolve()
    return new Promise(resolve => this.completedResolvers.push(resolve))
  }

  destroy() {
    for (const timer of this.timers) {
      clearTimeout(timer)
    }
    this.timers.clear()
    this.telemetry.destroys += 1
  }

  addPending() {
    this.pending += 1
  }

  resolvePending() {
    this.pending -= 1
    if (this.pending === 0) {
      for (const resolve of this.completedResolvers) {
        resolve()
      }
      this.completedResolvers = []
    }
  }
}

function defaultScheduler(callback, delay) {
  return setTimeout(callback, delay)
}
