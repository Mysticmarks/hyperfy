import { System } from './System'
import { generateChallengeLevel, generateLootDrops, mergeBiasTags } from '../extras/proceduralChallengeGenerator'
import { clamp, uuid } from '../utils'

const HISTORY_LIMIT = 25

function now() {
  return Date.now()
}

function ensureArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function ensureStringArray(value) {
  return ensureArray(value).map(entry => (typeof entry === 'string' ? entry : '')).filter(Boolean)
}

function toNumber(value, fallback) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function clampNumber(value, min, max, fallback) {
  const numeric = toNumber(value, fallback)
  return clamp(numeric, min, max)
}

function clone(value) {
  if (value === null || value === undefined) return value
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch (err) {
      // ignore and fallback
    }
  }
  return JSON.parse(JSON.stringify(value))
}

function normaliseVector(value, fallback = { x: 0, y: 0, z: 0 }) {
  if (Array.isArray(value) && value.length >= 3) {
    return {
      x: toNumber(value[0], fallback.x),
      y: toNumber(value[1], fallback.y),
      z: toNumber(value[2], fallback.z),
    }
  }
  if (typeof value === 'object' && value) {
    return {
      x: toNumber(value.x, fallback.x),
      y: toNumber(value.y, fallback.y),
      z: toNumber(value.z, fallback.z),
    }
  }
  return { ...fallback }
}

function sanitiseRarityBias(input = {}) {
  const result = {}
  for (const key of ['common', 'uncommon', 'rare', 'legendary']) {
    result[key] = clampNumber(input[key] ?? 0, -2, 2, 0)
  }
  return result
}

function sanitiseMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return {}
  return clone(metadata)
}

function buildDoor(options = {}, statsOverride) {
  const timestamp = now()
  const levelProfileInput = options.levelProfile || {}
  const minibossProfileInput = options.minibossProfile || {}
  const lootProfileInput = options.lootProfile || {}
  const doorOptionsInput = options.options || {}

  const door = {
    id: typeof options.id === 'string' ? options.id : `door-${uuid()}`,
    label: typeof options.label === 'string' ? options.label : 'Challenge Door',
    description: typeof options.description === 'string' ? options.description : '',
    position: normaliseVector(options.position),
    rotation: normaliseVector(options.rotation),
    levelProfile: {
      difficulty: clampNumber(levelProfileInput.difficulty ?? 2.5, 1, 5, 2.5),
      depth: clampNumber(levelProfileInput.depth ?? 3, 2, 6, 3),
      branchFactor: clampNumber(levelProfileInput.branchFactor ?? 3, 1, 5, 3),
      themeBias: ensureStringArray(levelProfileInput.themeBias),
      hazardBias: ensureStringArray(levelProfileInput.hazardBias),
    },
    minibossProfile: {
      archetypeBias: ensureStringArray(minibossProfileInput.archetypeBias),
      mutationCount: clampNumber(minibossProfileInput.mutationCount ?? 2, 0, 5, 2),
      statScale: clampNumber(minibossProfileInput.statScale ?? 1, 0.5, 2, 1),
    },
    lootProfile: {
      bonusRolls: clampNumber(lootProfileInput.bonusRolls ?? 0, -2, 6, 0),
      performanceScale: clampNumber(lootProfileInput.performanceScale ?? 0, -0.5, 1, 0),
      perPlayer: clampNumber(lootProfileInput.perPlayer ?? 0, -0.2, 1, 0),
      flatBonus: clampNumber(lootProfileInput.flatBonus ?? 0, -2, 6, 0),
      currencyScale: clampNumber(lootProfileInput.currencyScale ?? 0, -0.5, 2, 0),
      rarityBias: sanitiseRarityBias(lootProfileInput.rarityBias),
      tagBias: ensureStringArray(lootProfileInput.tagBias),
      weightBoost: clampNumber(lootProfileInput.weightBoost ?? 0.35, 0, 1.5, 0.35),
    },
    options: {
      allowConcurrent: Boolean(doorOptionsInput.allowConcurrent),
      autoRespawn: doorOptionsInput.autoRespawn !== false,
    },
    metadata: sanitiseMetadata(options.metadata),
    stats: {
      createdAt: statsOverride?.createdAt ?? timestamp,
      updatedAt: statsOverride?.updatedAt ?? timestamp,
      generated: statsOverride?.generated ?? 0,
      completions: statsOverride?.completions ?? 0,
      failures: statsOverride?.failures ?? 0,
      lastSeed: statsOverride?.lastSeed ?? null,
      lastChallengeId: statsOverride?.lastChallengeId ?? null,
      fastestCompletionMs: statsOverride?.fastestCompletionMs ?? null,
    },
    activeChallenges: new Set(),
  }

  if (statsOverride?.activeChallengeIds) {
    for (const id of statsOverride.activeChallengeIds) {
      if (typeof id === 'string') {
        door.activeChallenges.add(id)
      }
    }
  }

  return door
}

function serialiseDoorForStorage(door) {
  return {
    id: door.id,
    label: door.label,
    description: door.description,
    position: door.position,
    rotation: door.rotation,
    levelProfile: door.levelProfile,
    minibossProfile: door.minibossProfile,
    lootProfile: door.lootProfile,
    options: door.options,
    metadata: door.metadata,
    stats: {
      ...door.stats,
      activeChallengeIds: Array.from(door.activeChallenges),
    },
  }
}

function serialiseDoorForReturn(door) {
  return {
    id: door.id,
    label: door.label,
    description: door.description,
    position: clone(door.position),
    rotation: clone(door.rotation),
    levelProfile: clone(door.levelProfile),
    minibossProfile: clone(door.minibossProfile),
    lootProfile: clone(door.lootProfile),
    options: clone(door.options),
    metadata: clone(door.metadata),
    stats: clone(door.stats),
    activeChallengeIds: Array.from(door.activeChallenges),
  }
}

function serialiseChallengeRecord(record) {
  return {
    id: record.id,
    doorId: record.doorId,
    seed: record.seed,
    state: record.state,
    createdAt: record.createdAt,
    completedAt: record.completedAt ?? null,
    failedAt: record.failedAt ?? null,
    players: Array.from(record.players),
    challenge: clone(record.challenge),
    metadata: clone(record.metadata),
    result: clone(record.result ?? null),
  }
}

function mergeProfiles(baseProfile = {}, overrideProfile = {}) {
  const output = { ...baseProfile }
  for (const [key, value] of Object.entries(overrideProfile)) {
    if (Array.isArray(value)) {
      output[key] = ensureStringArray(value)
    } else if (value && typeof value === 'object') {
      output[key] = { ...output[key], ...value }
    } else if (value !== undefined) {
      output[key] = value
    }
  }
  return output
}

export class ProceduralChallenges extends System {
  constructor(world) {
    super(world)
    this.doors = new Map()
    this.activeChallenges = new Map()
    this.history = []
    this.storageKey = 'proceduralChallenges'
  }

  init() {
    this.loadFromStorage()
  }

  loadFromStorage() {
    const stored = this.world.storage?.get(this.storageKey)
    if (!stored?.doors) return
    for (const doorData of stored.doors) {
      const door = buildDoor(doorData, doorData.stats)
      this.doors.set(door.id, door)
    }
  }

  persist() {
    if (!this.world.storage) return
    const doors = Array.from(this.doors.values()).map(door => serialiseDoorForStorage(door))
    this.world.storage.set(this.storageKey, { doors })
  }

  listDoors() {
    return Array.from(this.doors.values()).map(door => serialiseDoorForReturn(door))
  }

  getDoor(id) {
    const door = this.doors.get(id)
    if (!door) return null
    return serialiseDoorForReturn(door)
  }

  createDoor(options = {}) {
    const door = buildDoor(options)
    if (this.doors.has(door.id)) {
      throw new Error(`[proceduralChallenges] Door already exists with id "${door.id}"`)
    }
    this.doors.set(door.id, door)
    this.persist()
    const serialised = serialiseDoorForReturn(door)
    this.emit('door-created', serialised)
    return serialised
  }

  updateDoor(id, changes = {}) {
    const door = this.doors.get(id)
    if (!door) {
      throw new Error(`[proceduralChallenges] Cannot update missing door "${id}"`)
    }
    if (changes.label !== undefined) {
      door.label = typeof changes.label === 'string' ? changes.label : door.label
    }
    if (changes.description !== undefined) {
      door.description = typeof changes.description === 'string' ? changes.description : door.description
    }
    if (changes.position !== undefined) {
      door.position = normaliseVector(changes.position, door.position)
    }
    if (changes.rotation !== undefined) {
      door.rotation = normaliseVector(changes.rotation, door.rotation)
    }
    if (changes.metadata) {
      door.metadata = sanitiseMetadata({ ...door.metadata, ...changes.metadata })
    }
    if (changes.levelProfile) {
      const merged = mergeProfiles(door.levelProfile, changes.levelProfile)
      door.levelProfile = {
        difficulty: clampNumber(merged.difficulty ?? door.levelProfile.difficulty, 1, 5, door.levelProfile.difficulty),
        depth: clampNumber(merged.depth ?? door.levelProfile.depth, 2, 6, door.levelProfile.depth),
        branchFactor: clampNumber(merged.branchFactor ?? door.levelProfile.branchFactor, 1, 5, door.levelProfile.branchFactor),
        themeBias: ensureStringArray(merged.themeBias ?? door.levelProfile.themeBias),
        hazardBias: ensureStringArray(merged.hazardBias ?? door.levelProfile.hazardBias),
      }
    }
    if (changes.minibossProfile) {
      const merged = mergeProfiles(door.minibossProfile, changes.minibossProfile)
      door.minibossProfile = {
        archetypeBias: ensureStringArray(merged.archetypeBias ?? door.minibossProfile.archetypeBias),
        mutationCount: clampNumber(merged.mutationCount ?? door.minibossProfile.mutationCount, 0, 5, door.minibossProfile.mutationCount),
        statScale: clampNumber(merged.statScale ?? door.minibossProfile.statScale, 0.5, 2, door.minibossProfile.statScale),
      }
    }
    if (changes.lootProfile) {
      const merged = mergeProfiles(door.lootProfile, changes.lootProfile)
      door.lootProfile = {
        bonusRolls: clampNumber(merged.bonusRolls ?? door.lootProfile.bonusRolls, -2, 6, door.lootProfile.bonusRolls),
        performanceScale: clampNumber(merged.performanceScale ?? door.lootProfile.performanceScale, -0.5, 1, door.lootProfile.performanceScale),
        perPlayer: clampNumber(merged.perPlayer ?? door.lootProfile.perPlayer, -0.2, 1, door.lootProfile.perPlayer),
        flatBonus: clampNumber(merged.flatBonus ?? door.lootProfile.flatBonus, -2, 6, door.lootProfile.flatBonus),
        currencyScale: clampNumber(merged.currencyScale ?? door.lootProfile.currencyScale, -0.5, 2, door.lootProfile.currencyScale),
        rarityBias: sanitiseRarityBias(merged.rarityBias ?? door.lootProfile.rarityBias),
        tagBias: ensureStringArray(merged.tagBias ?? door.lootProfile.tagBias),
        weightBoost: clampNumber(merged.weightBoost ?? door.lootProfile.weightBoost, 0, 1.5, door.lootProfile.weightBoost),
      }
    }
    if (changes.options) {
      const merged = mergeProfiles(door.options, changes.options)
      door.options = {
        allowConcurrent: Boolean(merged.allowConcurrent),
        autoRespawn: merged.autoRespawn !== false,
      }
    }
    door.stats.updatedAt = now()
    this.persist()
    const serialised = serialiseDoorForReturn(door)
    this.emit('door-updated', serialised)
    return serialised
  }

  removeDoor(id) {
    const door = this.doors.get(id)
    if (!door) return false
    if (door.activeChallenges.size) {
      throw new Error(`[proceduralChallenges] Cannot remove door "${id}" while challenges are active`)
    }
    this.doors.delete(id)
    this.persist()
    this.emit('door-removed', { id })
    return true
  }

  listActiveChallenges() {
    return Array.from(this.activeChallenges.values()).map(record => serialiseChallengeRecord(record))
  }

  getChallenge(id) {
    const record = this.activeChallenges.get(id)
    if (!record) return null
    return serialiseChallengeRecord(record)
  }

  previewChallenge(id, overrides = {}) {
    const door = this.doors.get(id)
    if (!door) {
      throw new Error(`[proceduralChallenges] Cannot preview missing door "${id}"`)
    }
    const options = this.buildGenerationOptions(door, overrides)
    return generateChallengeLevel(options)
  }

  buildGenerationOptions(door, overrides = {}) {
    const difficulty = overrides.difficulty ?? door.levelProfile.difficulty
    const depth = overrides.depth ?? door.levelProfile.depth
    const branchFactor = overrides.branchFactor ?? door.levelProfile.branchFactor
    const themeBias = mergeBiasTags(door.levelProfile.themeBias, overrides.themeBias)
    const hazardBias = mergeBiasTags(door.levelProfile.hazardBias, overrides.hazardBias)
    const minibossProfile = mergeProfiles(door.minibossProfile, overrides.minibossProfile || {})
    const lootProfile = mergeProfiles(door.lootProfile, overrides.lootProfile || {})
    lootProfile.rarityBias = { ...door.lootProfile.rarityBias, ...(overrides.lootProfile?.rarityBias || {}) }
    lootProfile.tagBias = mergeBiasTags(door.lootProfile.tagBias, overrides.lootProfile?.tagBias || [])
    return {
      seed: overrides.seed ?? now(),
      depth,
      branchFactor,
      difficulty,
      themeBias,
      hazardBias,
      minibossProfile,
      lootProfile,
    }
  }

  startChallenge(id, options = {}) {
    const door = this.doors.get(id)
    if (!door) {
      throw new Error(`[proceduralChallenges] Cannot start challenge from missing door "${id}"`)
    }
    if (!door.options.allowConcurrent && door.activeChallenges.size) {
      throw new Error(`[proceduralChallenges] Door "${door.id}" already has an active challenge`)
    }
    const generationOptions = this.buildGenerationOptions(door, options)
    const challenge = generateChallengeLevel(generationOptions)
    const challengeId = options.challengeId || `${door.id}-${challenge.seed}-${uuid()}`
    const players = new Set()
    for (const playerId of ensureArray(options.players || options.playerId)) {
      if (typeof playerId === 'string') players.add(playerId)
    }
    const record = {
      id: challengeId,
      doorId: door.id,
      seed: challenge.seed,
      state: 'active',
      createdAt: now(),
      players,
      challenge,
      metadata: sanitiseMetadata(options.metadata),
    }
    this.activeChallenges.set(challengeId, record)
    door.activeChallenges.add(challengeId)
    door.stats.generated += 1
    door.stats.lastSeed = challenge.seed
    door.stats.lastChallengeId = challengeId
    door.stats.updatedAt = now()
    this.persist()
    const serialised = serialiseChallengeRecord(record)
    this.emit('challenge-started', serialised)
    return serialised
  }

  completeChallenge(id, result = {}) {
    const record = this.activeChallenges.get(id)
    if (!record) {
      throw new Error(`[proceduralChallenges] Cannot complete missing challenge "${id}"`)
    }
    const door = this.doors.get(record.doorId)
    const lootBlueprint = record.challenge?.loot?.blueprint
    if (!lootBlueprint) {
      throw new Error('[proceduralChallenges] Challenge missing loot blueprint')
    }
    const loot = generateLootDrops({
      seed: (record.seed ?? now()) + 17,
      blueprint: {
        ...lootBlueprint,
        rarityWeights: {
          ...lootBlueprint.rarityWeights,
          common: lootBlueprint.rarityWeights.common + (door?.lootProfile?.rarityBias?.common ?? 0),
          uncommon: lootBlueprint.rarityWeights.uncommon + (door?.lootProfile?.rarityBias?.uncommon ?? 0),
          rare: lootBlueprint.rarityWeights.rare + (door?.lootProfile?.rarityBias?.rare ?? 0),
          legendary: lootBlueprint.rarityWeights.legendary + (door?.lootProfile?.rarityBias?.legendary ?? 0),
        },
      },
      difficulty: record.challenge.difficulty,
      performance: result.performance ?? 1,
      luck: result.luck ?? 0,
      bonusRolls: (result.bonusRolls ?? 0) + (door?.lootProfile?.bonusRolls ?? 0),
      playerCount: result.playerCount ?? record.players.size || 1,
      extraBiasTags: mergeBiasTags(result.extraBiasTags, (door?.lootProfile?.tagBias ?? [])),
    })
    record.state = 'completed'
    record.completedAt = now()
    record.result = {
      performance: result.performance ?? 1,
      luck: result.luck ?? 0,
      durationMs: result.durationMs ?? null,
      loot,
      notes: result.notes ?? null,
    }
    this.activeChallenges.delete(id)
    if (door) {
      door.activeChallenges.delete(id)
      door.stats.completions += 1
      if (typeof result.durationMs === 'number') {
        const best = door.stats.fastestCompletionMs
        if (!best || result.durationMs < best) {
          door.stats.fastestCompletionMs = result.durationMs
        }
      }
      door.stats.updatedAt = now()
    }
    const serialised = serialiseChallengeRecord(record)
    this.recordHistory(serialised)
    this.persist()
    this.emit('challenge-completed', serialised)
    return serialised
  }

  failChallenge(id, data = {}) {
    const record = this.activeChallenges.get(id)
    if (!record) {
      throw new Error(`[proceduralChallenges] Cannot fail missing challenge "${id}"`)
    }
    const door = this.doors.get(record.doorId)
    record.state = 'failed'
    record.failedAt = now()
    record.result = {
      reason: data.reason ?? 'failed',
      notes: data.notes ?? null,
    }
    this.activeChallenges.delete(id)
    if (door) {
      door.activeChallenges.delete(id)
      door.stats.failures += 1
      door.stats.updatedAt = now()
    }
    const serialised = serialiseChallengeRecord(record)
    this.recordHistory(serialised)
    this.persist()
    this.emit('challenge-failed', serialised)
    return serialised
  }

  recordHistory(entry) {
    this.history.unshift(entry)
    if (this.history.length > HISTORY_LIMIT) {
      this.history.length = HISTORY_LIMIT
    }
  }

  getHistory(limit = 10) {
    return this.history.slice(0, clamp(limit, 1, HISTORY_LIMIT))
  }
}
