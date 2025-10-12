import { cloneDeep, merge } from 'lodash-es'
import { System } from './System'
import { DEFAULT_COMPANIONS } from '../extras/companionDefaults'
import { uuid } from '../utils'

const STORAGE_KEY = 'companions.state'

function seededRandom(seed) {
  if (seed === undefined || seed === null) {
    return Math.random
  }
  let s = typeof seed === 'number' ? seed : Array.from(String(seed)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  s |= 0
  return () => {
    s = Math.imul(1597334677, s) + 1
    return ((s ^ (s >>> 13)) >>> 0) / 4294967296
  }
}

function pick(rand, list) {
  return list[Math.floor(rand() * list.length)]
}

function clone(value) {
  return value === undefined ? undefined : cloneDeep(value)
}

export class Companions extends System {
  constructor(world) {
    super(world)
    this.registry = new Map()
    this.assignments = new Map()
    this.instances = new Map()
    this.ownerToInstance = new Map()
    this.storage = null
    this.state = {
      registry: [],
      assignments: {},
    }
    this.ready = false

    this.onEntityAdded = this.onEntityAdded.bind(this)
    this.onEntityRemoved = this.onEntityRemoved.bind(this)
    this.onPlayerEnter = this.onPlayerEnter.bind(this)
    this.onPlayerLeave = this.onPlayerLeave.bind(this)
  }

  async init({ storage } = {}) {
    this.storage = storage || null
    if (this.world.network?.isServer) {
      await this.loadFromStorage()
      this.ensureDefaultRegistry()
      this.persistState()
    }
  }

  start() {
    this.world.entities.on('added', this.onEntityAdded)
    this.world.entities.on('removed', this.onEntityRemoved)
    this.world.events.on('enter', this.onPlayerEnter)
    this.world.events.on('leave', this.onPlayerLeave)
    this.ready = true
  }

  destroy() {
    this.world.entities.off('added', this.onEntityAdded)
    this.world.entities.off('removed', this.onEntityRemoved)
    this.world.events.off('enter', this.onPlayerEnter)
    this.world.events.off('leave', this.onPlayerLeave)
  }

  async loadFromStorage() {
    if (!this.storage) return
    try {
      const data = this.storage.get(STORAGE_KEY)
      if (data?.registry) {
        this.deserializeState(data, { broadcast: false })
      }
    } catch (err) {
      console.warn('failed to load companions from storage', err)
    }
  }

  ensureDefaultRegistry() {
    if (this.registry.size > 0) return
    for (const def of DEFAULT_COMPANIONS) {
      this.registry.set(def.id, cloneDeep(def))
    }
    this.updateState()
  }

  getState() {
    return cloneDeep(this.state)
  }

  serializeState() {
    return this.getState()
  }

  deserialize(state, options = {}) {
    this.deserializeState(state, options)
  }

  deserializeState(state = {}, { broadcast = true } = {}) {
    const registry = state.registry || []
    const assignments = state.assignments || {}
    this.registry.clear()
    for (const def of registry) {
      this.registry.set(def.id, cloneDeep(def))
    }
    this.assignments = new Map(Object.entries(assignments))
    this.updateState()
    if (broadcast) this.emitChange()
  }

  updateState() {
    this.state.registry = Array.from(this.registry.values()).map(def => cloneDeep(def))
    const obj = {}
    this.assignments.forEach((value, key) => {
      obj[key] = value
    })
    this.state.assignments = obj
    this.emitChange()
  }

  emitChange() {
    if (!this.ready) return
    this.emit('change', this.getState())
  }

  persistState() {
    if (!this.world.network?.isServer) return
    if (!this.storage) return
    this.storage.set(STORAGE_KEY, this.serializeState())
  }

  broadcastState() {
    if (!this.world.network?.isServer) return
    this.world.network.send('companionsState', this.serializeState())
  }

  createDefinition(definition = {}, { setDefault = false } = {}) {
    const id = definition.id || uuid()
    const now = Date.now()
    const next = merge(
      {
        id,
        name: 'New Companion',
        title: null,
        persona: '',
        archetype: 'Custom',
        appearance: {
          type: 'avatar',
          url: 'asset://avatar.vrm',
          scale: 1,
          tint: '#ffffff',
          locomotionSet: 'humanoid',
        },
        locomotion: {
          walk: true,
          swim: false,
          fly: false,
          hover: false,
          dig: false,
        },
        behavior: {
          followDistance: 2.4,
          followHeight: 0,
          followResponsiveness: 3,
          tetherRadius: 14,
          idleOrbit: true,
          idleOrbitRadius: 1,
          idleOrbitSpeed: 0.4,
          manualTimeout: 2.5,
          movementSpeed: 3,
        },
        skills: [],
        instructions: {
          chat: '',
          combat: '',
          exploration: '',
        },
        llm: {
          prompt: '',
          voice: null,
        },
        metadata: {
          createdAt: now,
          updatedAt: now,
          rarity: 'uncommon',
          tags: [],
          default: false,
        },
      },
      cloneDeep(definition)
    )
    next.metadata.updatedAt = now
    this.registry.set(next.id, next)
    if (setDefault) {
      this.setDefaultTemplate(next.id)
    }
    this.updateState()
    this.persistState()
    this.broadcastState()
    return next
  }

  updateDefinition(id, changes = {}) {
    const current = this.registry.get(id)
    if (!current) return null
    const next = merge({}, current, cloneDeep(changes))
    next.metadata = {
      ...(current.metadata || {}),
      updatedAt: Date.now(),
    }
    this.registry.set(id, next)
    if (changes?.metadata?.default) {
      this.setDefaultTemplate(id)
    }
    this.updateState()
    this.persistState()
    this.broadcastState()
    return next
  }

  removeDefinition(id) {
    if (!this.registry.has(id)) return
    this.registry.delete(id)
    for (const [playerId, templateId] of this.assignments.entries()) {
      if (templateId === id) {
        this.assignments.delete(playerId)
      }
    }
    this.updateState()
    this.persistState()
    this.broadcastState()
  }

  setDefaultTemplate(id) {
    this.registry.forEach(def => {
      def.metadata = def.metadata || {}
      def.metadata.default = def.id === id
    })
  }

  getDefaultTemplate() {
    for (const def of this.registry.values()) {
      if (def.metadata?.default) return def
    }
    return this.registry.values().next().value
  }

  generateDefinition(options = {}) {
    const rand = seededRandom(options.seed)
    const archetypes = [
      'Aerial Sentinel',
      'Arcane Trickster',
      'Deepwater Sage',
      'Glacial Vanguard',
      'Radiant Muse',
      'Verdant Stalker',
    ]
    const nameFragments = {
      prefix: ['Star', 'Gale', 'Rune', 'Ash', 'Lume', 'Iron', 'Frost', 'Nim', 'Sky', 'Thorn', 'Azure', 'Wisp'],
      suffix: ['ling', 'shade', 'bright', 'ward', 'spark', 'flare', 'song', 'clasp', 'stride', 'weaver'],
    }
    const titles = [
      'Wayfinder',
      'Skysworn',
      'Hearthbound',
      'Mythkeeper',
      'Shadowguide',
      'Chronicle Warden',
      'Dreamthreader',
    ]
    const personas = [
      'A playful storyteller who adores improvising daring plans and celebrating small victories.',
      'A pragmatic tactician who keeps conversations grounded and forward-looking.',
      'A softly spoken mystic who sees omens in every breeze and ripple.',
      'A bombastic champion who treats every skirmish like a festival arena.',
      'A scholarly companion obsessed with cataloging fauna, flora, and folklore.',
      'A mischievous trickster who loves testing boundaries but never betrays trust.',
    ]

    const locomotionPresets = [
      { walk: true, swim: false, fly: true, hover: true, dig: false },
      { walk: true, swim: true, fly: false, hover: false, dig: false },
      { walk: true, swim: false, fly: false, hover: false, dig: true },
      { walk: true, swim: true, fly: true, hover: true, dig: false },
    ]

    const name = options.name || `${pick(rand, nameFragments.prefix)}${pick(rand, nameFragments.suffix)}`
    const def = {
      id: uuid(),
      name,
      title: options.title || pick(rand, titles),
      persona: options.persona || pick(rand, personas),
      archetype: options.archetype || pick(rand, archetypes),
      appearance: {
        type: 'avatar',
        url: options.model || 'asset://avatar.vrm',
        scale: options.scale || 1,
        tint: options.tint || '#ffffff',
        locomotionSet: options.locomotionSet || 'humanoid',
      },
      locomotion: { ...(pick(rand, locomotionPresets)) },
      behavior: {
        followDistance: options.followDistance || (2 + rand() * 2.5),
        followHeight: options.followHeight ?? (rand() * 1 - 0.2),
        followResponsiveness: 2.5 + rand() * 2,
        tetherRadius: 10 + rand() * 8,
        idleOrbit: rand() > 0.3,
        idleOrbitRadius: 0.8 + rand() * 1.5,
        idleOrbitSpeed: 0.3 + rand() * 0.6,
        manualTimeout: 2 + rand() * 2,
        movementSpeed: 2.5 + rand() * 1.5,
      },
      skills: options.skills || [
        {
          id: `${name.toLowerCase()}-signature`,
          name: `${name.split(' ')[0]} Signature`,
          description: 'Unleashes a signature technique tailored to the companion’s archetype, empowering the player momentarily.',
          cooldown: 12 + Math.floor(rand() * 8),
          tags: ['signature', 'utility'],
        },
        {
          id: `${name.toLowerCase()}-support`,
          name: `${pick(rand, ['Aegis', 'Pulse', 'Resonance', 'Veil'])} Support`,
          description: 'Provides situational support, either by shielding, healing, or amplifying the player’s abilities.',
          cooldown: 16 + Math.floor(rand() * 10),
          tags: ['support'],
        },
      ],
      instructions: {
        chat:
          options.instructions?.chat ||
          'Maintain an adaptive conversational tone. Reference shared experiences and encourage the player toward their goals.',
        combat:
          options.instructions?.combat ||
          'Coordinate attacks, call out openings, and dynamically react to threats based on the companion’s skill loadout.',
        exploration:
          options.instructions?.exploration ||
          'Highlight noteworthy landmarks, secrets, and lore while aligning suggestions with the player’s playstyle.',
      },
      llm: {
        prompt:
          options.llm?.prompt ||
          `You are ${name}, a ${options.archetype || 'versatile companion'} sworn to aid the player. Blend personality-rich banter with tactical insight.`,
        voice: options.llm?.voice || null,
      },
      metadata: {
        rarity: options.metadata?.rarity || pick(rand, ['common', 'uncommon', 'rare', 'epic']),
        tags: options.metadata?.tags || [options.archetype || 'companion'],
        default: !!options.metadata?.default,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    }

    return this.createDefinition(def, { setDefault: !!def.metadata.default })
  }

  assign(playerId, templateId, { broadcast = true } = {}) {
    if (!playerId) return
    if (templateId && !this.registry.has(templateId)) return
    if (templateId) {
      this.assignments.set(playerId, templateId)
      if (this.world.network?.isServer) {
        this.spawnCompanion(playerId, templateId)
      }
    } else {
      this.assignments.delete(playerId)
      if (this.world.network?.isServer) {
        this.despawnCompanion(playerId)
      }
    }
    this.updateState()
    this.persistState()
    if (broadcast) this.broadcastState()
  }

  ensureCompanionForPlayer(playerId, { broadcast = true } = {}) {
    const id = typeof playerId === 'string' ? playerId : playerId?.data?.id
    if (!id) return
    let templateId = this.assignments.get(id)
    if (!templateId || !this.registry.has(templateId)) {
      const def = this.getDefaultTemplate()
      if (!def) return
      templateId = def.id
      this.assignments.set(id, templateId)
    }
    if (this.world.network?.isServer) {
      this.spawnCompanion(id, templateId)
      this.updateState()
      this.persistState()
      if (broadcast) this.broadcastState()
    }
  }

  spawnCompanion(playerId, templateId) {
    if (!this.world.network?.isServer) return
    const template = this.registry.get(templateId)
    if (!template) return
    this.despawnCompanion(playerId, { broadcast: false })

    const entityId = uuid()
    const owner = this.world.entities.get(playerId)
    const position = owner?.base?.position ? owner.base.position.toArray() : [0, 0, 0]
    const quaternion = owner?.base?.quaternion ? owner.base.quaternion.toArray() : [0, 0, 0, 1]

    const data = {
      id: entityId,
      type: 'companion',
      ownerId: playerId,
      templateId,
      name: template.name,
      displayName: template.title ? `${template.name}, ${template.title}` : template.name,
      title: template.title,
      persona: template.persona,
      archetype: template.archetype,
      appearance: clone(template.appearance),
      locomotion: clone(template.locomotion),
      behavior: clone(template.behavior),
      skills: clone(template.skills),
      instructions: clone(template.instructions),
      llm: clone(template.llm),
      metadata: clone(template.metadata),
      position,
      quaternion,
      state: {
        mode: 'follow',
      },
    }

    const entity = this.world.entities.add(data, true)
    this.instances.set(entityId, entity)
    this.ownerToInstance.set(playerId, entityId)
    return entity
  }

  despawnCompanion(playerId, { broadcast = true } = {}) {
    const entityId = this.ownerToInstance.get(playerId)
    if (!entityId) return
    const entity = this.instances.get(entityId) || this.world.entities.get(entityId)
    if (this.world.network?.isServer && broadcast) {
      this.world.network.send('entityRemoved', entityId)
    }
    this.world.entities.remove(entityId)
    this.instances.delete(entityId)
    this.ownerToInstance.delete(playerId)
  }

  onEntityAdded(entity) {
    if (!entity?.isCompanion) return
    const playerId = entity.data.ownerId
    this.instances.set(entity.data.id, entity)
    this.ownerToInstance.set(playerId, entity.data.id)
    if (entity.data.templateId) {
      this.assignments.set(playerId, entity.data.templateId)
      this.updateState()
    }
  }

  onEntityRemoved(entity) {
    if (!entity?.isCompanion) return
    this.instances.delete(entity.data.id)
    if (entity.data.ownerId) {
      this.ownerToInstance.delete(entity.data.ownerId)
      this.assignments.delete(entity.data.ownerId)
      this.updateState()
    }
  }

  onPlayerEnter({ playerId }) {
    if (!this.world.network?.isServer) return
    this.ensureCompanionForPlayer(playerId)
  }

  onPlayerLeave({ playerId }) {
    if (!this.world.network?.isServer) return
    this.despawnCompanion(playerId)
    this.assignments.delete(playerId)
    this.updateState()
    this.persistState()
    this.broadcastState()
  }

  sendDirective(companionId, directive) {
    const entity = this.instances.get(companionId) || this.world.entities.get(companionId)
    if (!entity?.isCompanion) return
    entity.applyDirective(directive)
    if (this.world.network?.isServer) {
      this.world.network.send('entityEvent', [companionId, 0, 'companion-directive', directive])
    }
  }

  speak(companionId, message, options) {
    const entity = this.instances.get(companionId) || this.world.entities.get(companionId)
    if (!entity?.isCompanion) return
    entity.speak(message, options)
    if (this.world.network?.isServer) {
      this.world.network.send('entityEvent', [companionId, 0, 'companion-chat', { ...options, text: message }])
    }
  }

  // Client helpers ---------------------------------------------------------

  create(definition) {
    if (this.world.network?.isServer) {
      return this.createDefinition(definition)
    }
    this.world.network?.send('companionRegistryUpdate', { op: 'create', definition })
  }

  update(id, changes) {
    if (this.world.network?.isServer) {
      return this.updateDefinition(id, changes)
    }
    this.world.network?.send('companionRegistryUpdate', { op: 'update', id, changes })
  }

  remove(id) {
    if (this.world.network?.isServer) {
      return this.removeDefinition(id)
    }
    this.world.network?.send('companionRegistryUpdate', { op: 'remove', id })
  }

  generate(options) {
    if (this.world.network?.isServer) {
      return this.generateDefinition(options)
    }
    this.world.network?.send('companionGenerate', options || {})
  }

  assignToPlayer(playerId, templateId) {
    if (this.world.network?.isServer) {
      return this.assign(playerId, templateId)
    }
    this.world.network?.send('companionAssign', { playerId, templateId })
  }
}
