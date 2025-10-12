import { cloneDeep, merge } from 'lodash-es'
import { System } from './System'
import { DEFAULT_MOUNTS } from '../extras/mountDefaults'
import { uuid } from '../utils'

const STORAGE_KEY = 'mounts.state'
const MAX_MOUNT_SCALE = 3

function clone(value) {
  return value === undefined ? undefined : cloneDeep(value)
}

function sanitizeMovement(movement = {}) {
  return {
    walk: !!movement.walk,
    swim: !!movement.swim,
    fly: !!movement.fly,
  }
}

function sanitizeSeating(seating = []) {
  if (!Array.isArray(seating)) return []
  const seen = new Set()
  const sanitized = []
  seating.forEach((seat, index) => {
    if (!seat || typeof seat !== 'object') return
    const id = String(seat.id || seat.label || `seat-${index}`)
    if (seen.has(id)) return
    seen.add(id)
    const type = seat.type === 'companion' ? 'companion' : 'player'
    sanitized.push({
      id,
      type,
      label: seat.label || (type === 'player' ? 'Rider' : 'Companion'),
      required: !!seat.required,
    })
  })
  if (sanitized.length === 0) {
    sanitized.push(
      { id: 'pilot', type: 'player', label: 'Rider', required: true },
      { id: 'buddy', type: 'companion', label: 'Companion', required: false }
    )
  }
  return sanitized
}

function sanitizeAppearance(appearance = {}) {
  const next = cloneDeep(appearance)
  const currentScale = typeof next.scale === 'number' ? next.scale : 1.2
  next.scale = Math.min(Math.max(currentScale, 0.3), MAX_MOUNT_SCALE)
  if (typeof next.height === 'number') {
    next.height = Math.max(0.5, Math.min(next.height, MAX_MOUNT_SCALE * 2.5))
  }
  return next
}

export class Mounts extends System {
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
    this.onCompanionAssigned = this.onCompanionAssigned.bind(this)
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
    this.world.companions?.on('assigned', this.onCompanionAssigned)
    this.ready = true
  }

  destroy() {
    this.world.entities.off('added', this.onEntityAdded)
    this.world.entities.off('removed', this.onEntityRemoved)
    this.world.events.off('enter', this.onPlayerEnter)
    this.world.events.off('leave', this.onPlayerLeave)
    this.world.companions?.off('assigned', this.onCompanionAssigned)
  }

  async loadFromStorage() {
    if (!this.storage) return
    try {
      const data = this.storage.get(STORAGE_KEY)
      if (data?.registry) {
        this.deserializeState(data, { broadcast: false })
      }
    } catch (err) {
      console.warn('failed to load mounts from storage', err)
    }
  }

  ensureDefaultRegistry() {
    if (this.registry.size > 0) return
    for (const def of DEFAULT_MOUNTS) {
      const sanitized = {
        ...cloneDeep(def),
        movement: sanitizeMovement(def.movement || {}),
        seating: sanitizeSeating(def.seating || []),
        appearance: sanitizeAppearance(def.appearance || {}),
      }
      this.registry.set(sanitized.id, sanitized)
    }
    this.updateState()
  }

  getDefaultTemplate() {
    let defaultTemplate = null
    for (const def of this.registry.values()) {
      if (def.metadata?.default) {
        defaultTemplate = def
        break
      }
    }
    if (!defaultTemplate) {
      defaultTemplate = this.registry.values().next().value
    }
    return defaultTemplate || null
  }

  getState() {
    return cloneDeep(this.state)
  }

  serializeState() {
    return this.getState()
  }

  deserializeState(state = {}, { broadcast = true } = {}) {
    const registry = state.registry || []
    const assignments = state.assignments || {}
    this.registry.clear()
    for (const def of registry) {
      this.registry.set(def.id, {
        ...cloneDeep(def),
        movement: sanitizeMovement(def.movement || {}),
        seating: sanitizeSeating(def.seating || []),
        appearance: sanitizeAppearance(def.appearance || {}),
      })
    }
    this.assignments = new Map()
    for (const [playerId, payload] of Object.entries(assignments)) {
      if (!payload || !payload.mountId) continue
      if (!this.registry.has(payload.mountId)) continue
      this.assignments.set(playerId, {
        mountId: payload.mountId,
        seats: cloneDeep(payload.seats || {}),
      })
    }
    this.updateState()
    if (broadcast) this.emitChange()
  }

  updateState() {
    this.state.registry = Array.from(this.registry.values()).map(def => cloneDeep(def))
    const obj = {}
    this.assignments.forEach((value, key) => {
      obj[key] = { mountId: value.mountId, seats: cloneDeep(value.seats || {}) }
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
    this.world.network.send('mountsState', this.serializeState())
  }

  createDefinition(definition = {}, { setDefault = false } = {}) {
    const id = definition.id || uuid()
    const now = Date.now()
    const next = merge(
      {
        id,
        name: 'New Mount',
        description: '',
        appearance: {
          type: 'model',
          url: 'asset://mount.glb',
          scale: 1.2,
          height: 1.6,
        },
        movement: {
          walk: true,
          swim: false,
          fly: false,
        },
        seating: [
          { id: 'pilot', type: 'player', label: 'Rider', required: true },
          { id: 'buddy', type: 'companion', label: 'Companion', required: false },
        ],
        metadata: {
          rarity: 'common',
          tags: ['mount'],
          default: false,
          createdAt: now,
          updatedAt: now,
        },
      },
      cloneDeep(definition)
    )

    next.movement = sanitizeMovement(next.movement || {})
    next.seating = sanitizeSeating(next.seating || [])
    next.appearance = sanitizeAppearance(next.appearance || {})
    next.metadata = {
      ...(next.metadata || {}),
      default: setDefault || !!next.metadata?.default,
      updatedAt: Date.now(),
      createdAt: next.metadata?.createdAt || now,
    }

    if (next.metadata.default) {
      for (const def of this.registry.values()) {
        if (def.metadata) def.metadata.default = false
      }
    }

    this.registry.set(next.id, next)
    this.updateState()
    this.persistState()
    this.broadcastState()
    return next
  }

  updateDefinition(id, changes = {}) {
    const def = this.registry.get(id)
    if (!def) return null
    const next = merge(cloneDeep(def), cloneDeep(changes))
    next.movement = sanitizeMovement(next.movement || {})
    next.seating = sanitizeSeating(next.seating || [])
    next.appearance = sanitizeAppearance(next.appearance || {})
    next.metadata = {
      ...(next.metadata || {}),
      default: !!next.metadata?.default,
      updatedAt: Date.now(),
      createdAt: next.metadata?.createdAt || def.metadata?.createdAt || Date.now(),
    }
    if (next.metadata.default) {
      for (const item of this.registry.values()) {
        if (item.metadata) item.metadata.default = item.id === id
      }
    }
    this.registry.set(id, next)
    this.updateState()
    this.persistState()
    this.broadcastState()
    return next
  }

  removeDefinition(id) {
    if (!this.registry.has(id)) return
    this.registry.delete(id)
    for (const [playerId, assignment] of Array.from(this.assignments.entries())) {
      if (assignment.mountId === id) {
        this.assignments.delete(playerId)
        if (this.world.network?.isServer) {
          this.despawnMount(playerId)
        }
      }
    }
    this.updateState()
    this.persistState()
    this.broadcastState()
  }

  assign(playerId, templateId, { broadcast = true } = {}) {
    if (!playerId) return
    if (templateId && !this.registry.has(templateId)) return
    const current = this.assignments.get(playerId)
    if (templateId) {
      if (current?.mountId === templateId && current?.seats) {
        this.assignments.set(playerId, {
          mountId: templateId,
          seats: cloneDeep(current.seats),
        })
      } else {
        const seats = this.createSeatState(playerId, templateId)
        this.assignments.set(playerId, { mountId: templateId, seats })
      }
      if (this.world.network?.isServer) {
        this.spawnMount(playerId, templateId)
      }
    } else {
      this.assignments.delete(playerId)
      if (this.world.network?.isServer) {
        this.despawnMount(playerId)
      }
    }
    this.updateState()
    this.persistState()
    if (broadcast) this.broadcastState()
    this.emit('assigned', { playerId, mountId: templateId || null })
    if (templateId) {
      this.syncSeatsForPlayer(playerId, { broadcast })
    }
  }

  ensureMountForPlayer(playerId, { broadcast = true } = {}) {
    const id = typeof playerId === 'string' ? playerId : playerId?.data?.id
    if (!id) return
    const assignment = this.assignments.get(id)
    if (assignment?.mountId && this.registry.has(assignment.mountId)) {
      if (this.world.network?.isServer) {
        const entityId = this.ownerToInstance.get(id)
        if (!entityId) {
          this.spawnMount(id, assignment.mountId)
        }
      }
      this.emit('assigned', { playerId: id, mountId: assignment.mountId })
      this.syncSeatsForPlayer(id, { broadcast })
      return
    }
    const def = this.getDefaultTemplate()
    if (!def) return
    this.assign(id, def.id, { broadcast })
  }

  createSeatState(playerId, templateId) {
    const template = this.registry.get(templateId)
    if (!template) return {}
    const seats = {}
    const companionId = this.resolveCompanionOccupant(playerId)
    for (const seat of template.seating) {
      if (seat.type === 'player') {
        seats[seat.id] = playerId
      } else if (seat.type === 'companion') {
        seats[seat.id] = companionId || null
      } else {
        seats[seat.id] = null
      }
    }
    return seats
  }

  resolveCompanionOccupant(playerId) {
    const companions = this.world.companions
    if (!companions) return null
    const entityId = companions.ownerToInstance?.get(playerId)
    if (entityId) return entityId
    const templateId = companions.assignments?.get(playerId)
    return templateId || null
  }

  syncSeatsForPlayer(playerId, { broadcast = true } = {}) {
    const assignment = this.assignments.get(playerId)
    if (!assignment) return
    const template = this.registry.get(assignment.mountId)
    if (!template) return
    const seats = { ...(assignment.seats || {}) }
    let changed = false
    const companionId = this.resolveCompanionOccupant(playerId)
    for (const seat of template.seating) {
      if (seat.type === 'player') {
        if (seats[seat.id] !== playerId) {
          seats[seat.id] = playerId
          changed = true
        }
      } else if (seat.type === 'companion') {
        if (seats[seat.id] !== (companionId || null)) {
          seats[seat.id] = companionId || null
          changed = true
        }
      }
    }
    if (!changed) return
    assignment.seats = cloneDeep(seats)
    this.assignments.set(playerId, assignment)
    this.updateState()
    this.persistState()
    if (this.world.network?.isServer) {
      const entityId = this.ownerToInstance.get(playerId)
      if (entityId) {
        this.world.network.send('entityModified', { id: entityId, seats: cloneDeep(seats) })
      }
    } else {
      const entityId = this.ownerToInstance.get(playerId)
      const entity = entityId ? this.world.entities.get(entityId) : null
      entity?.modify({ seats: cloneDeep(seats) })
    }
    if (broadcast) this.broadcastState()
  }

  spawnMount(playerId, templateId) {
    if (!this.world.network?.isServer) return
    const template = this.registry.get(templateId)
    if (!template) return
    this.despawnMount(playerId, { broadcast: false })

    const entityId = uuid()
    const owner = this.world.entities.get(playerId)
    const position = owner?.base?.position ? owner.base.position.toArray() : [0, 0, 0]
    const quaternion = owner?.base?.quaternion ? owner.base.quaternion.toArray() : [0, 0, 0, 1]
    const seats = cloneDeep(this.assignments.get(playerId)?.seats || this.createSeatState(playerId, templateId))

    const data = {
      id: entityId,
      type: 'mount',
      ownerId: playerId,
      templateId,
      name: template.name,
      description: template.description,
      appearance: clone(template.appearance),
      movement: clone(template.movement),
      seating: clone(template.seating),
      seats,
      position,
      quaternion,
    }

    const entity = this.world.entities.add(data, true)
    this.instances.set(entityId, entity)
    this.ownerToInstance.set(playerId, entityId)
    return entity
  }

  despawnMount(playerId, { broadcast = true } = {}) {
    const entityId = this.ownerToInstance.get(playerId)
    if (!entityId) return
    const entity = this.instances.get(entityId) || this.world.entities.get(entityId)
    if (this.world.network?.isServer && broadcast) {
      this.world.network.send('entityRemoved', entityId)
    }
    if (entity) {
      entity.destroy()
    }
    this.instances.delete(entityId)
    this.ownerToInstance.delete(playerId)
  }

  onEntityAdded(entity) {
    if (entity?.isMount) {
      this.instances.set(entity.data.id, entity)
      if (entity.data.ownerId) {
        this.ownerToInstance.set(entity.data.ownerId, entity.data.id)
      }
      return
    }
    if (entity?.isCompanion && entity.data.ownerId) {
      this.syncSeatsForPlayer(entity.data.ownerId, { broadcast: false })
    }
  }

  onEntityRemoved(entity) {
    if (entity?.isMount) {
      this.instances.delete(entity.data.id)
      if (entity.data.ownerId) {
        this.ownerToInstance.delete(entity.data.ownerId)
      }
      return
    }
    if (entity?.isCompanion && entity.data.ownerId) {
      this.syncSeatsForPlayer(entity.data.ownerId)
    }
  }

  onPlayerEnter({ playerId }) {
    this.ensureMountForPlayer(playerId, { broadcast: false })
  }

  onPlayerLeave({ playerId }) {
    if (!playerId) return
    if (this.world.network?.isServer) {
      this.despawnMount(playerId)
      return
    }
    const entityId = this.ownerToInstance.get(playerId)
    if (!entityId) return
    const entity = this.instances.get(entityId) || this.world.entities.get(entityId)
    entity?.destroy()
    this.instances.delete(entityId)
    this.ownerToInstance.delete(playerId)
  }

  onCompanionAssigned({ playerId }) {
    if (!playerId) return
    this.syncSeatsForPlayer(playerId)
  }

  // Client helpers ---------------------------------------------------------

  create(definition) {
    if (this.world.network?.isServer) {
      return this.createDefinition(definition)
    }
    this.world.network?.send('mountRegistryUpdate', { op: 'create', definition })
  }

  update(id, changes) {
    if (this.world.network?.isServer) {
      return this.updateDefinition(id, changes)
    }
    this.world.network?.send('mountRegistryUpdate', { op: 'update', id, changes })
  }

  remove(id) {
    if (this.world.network?.isServer) {
      return this.removeDefinition(id)
    }
    this.world.network?.send('mountRegistryUpdate', { op: 'remove', id })
  }

  assignToPlayer(playerId, templateId) {
    if (this.world.network?.isServer) {
      return this.assign(playerId, templateId)
    }
    this.world.network?.send('mountAssign', { playerId, templateId })
  }
}
