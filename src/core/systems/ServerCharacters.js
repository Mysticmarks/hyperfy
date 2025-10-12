import moment from 'moment'
import { cloneDeep } from 'lodash-es'
import { System } from './System'
import { uuid } from '../utils'

const DEFAULT_POSITION = [0, 0, 0]
const DEFAULT_QUATERNION = [0, 0, 0, 1]
const DEFAULT_STATS = {
  health: 100,
  stamina: 100,
  mana: 0,
}

function safeParseJSON(value, fallback) {
  if (!value) return cloneDeep(fallback)
  try {
    return JSON.parse(value)
  } catch (err) {
    return cloneDeep(fallback)
  }
}

function mapInventoryRow(row) {
  return {
    id: row.id,
    characterId: row.characterId,
    itemId: row.itemId,
    slot: row.slot,
    quantity: row.quantity,
    metadata: safeParseJSON(row.metadata, {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapQuestRow(row) {
  return {
    id: row.id,
    characterId: row.characterId,
    questId: row.questId,
    status: row.status,
    progress: safeParseJSON(row.progress, {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export class ServerCharacters extends System {
  constructor(world) {
    super(world)
    this.zoneId = null
    this.db = null
    this.charactersById = new Map()
    this.charactersByUserId = new Map()
  }

  async init({ db }) {
    this.db = db
    this.zoneId = this.world.zoneId ?? 'default'
  }

  async getCharacterById(characterId) {
    if (!characterId) return null
    const cached = this.charactersById.get(characterId)
    if (cached) return cached
    const row = await this.db('characters').where({ id: characterId }).first()
    if (!row) return null
    const character = await this.#hydrateFromRow(row)
    this.#cacheCharacter(character)
    return character
  }

  async getCharacterByUserId(userId, options = {}) {
    if (!userId) return null
    const { create = false, name = 'Adventurer', spawn = null } = options
    const cached = this.charactersByUserId.get(userId)
    if (cached) return cached
    let row = await this.db('characters')
      .where({ userId, zoneId: this.zoneId })
      .first()
    if (!row && create) {
      row = await this.#createCharacterRow(userId, name, spawn)
    }
    if (!row) return null
    const character = await this.#hydrateFromRow(row)
    this.#cacheCharacter(character)
    return character
  }

  serializeForClient(character) {
    if (!character) return null
    return {
      id: character.id,
      userId: character.userId,
      zoneId: character.zoneId,
      name: character.name,
      level: character.level,
      experience: character.experience,
      currency: character.currency,
      stats: cloneDeep(character.stats ?? {}),
      position: cloneDeep(character.position ?? DEFAULT_POSITION),
      quaternion: cloneDeep(character.quaternion ?? DEFAULT_QUATERNION),
      inventory: character.inventory.map(item => ({ ...item, metadata: cloneDeep(item.metadata ?? {}) })),
      quests: character.quests.map(quest => ({ ...quest, progress: cloneDeep(quest.progress ?? {}) })),
      lastLogin: character.lastLogin,
      lastLogout: character.lastLogout,
      createdAt: character.createdAt,
      updatedAt: character.updatedAt,
    }
  }

  attachToPlayer(player, character) {
    if (!player || !character) return null
    const snapshot = this.serializeForClient(character)
    player.data.characterId = character.id
    player.data.character = snapshot
    player.data.level = character.level
    player.data.experience = character.experience
    player.data.currency = character.currency
    player.data.stats = cloneDeep(character.stats)
    player.data.inventory = snapshot.inventory
    player.data.quests = snapshot.quests
    if (typeof character.stats?.health === 'number') {
      player.data.health = character.stats.health
    }
    return snapshot
  }

  resolveSpawn(character, fallbackSpawn) {
    const fallbackPosition = fallbackSpawn?.position ?? DEFAULT_POSITION
    const fallbackQuaternion = fallbackSpawn?.quaternion ?? DEFAULT_QUATERNION
    const position = character?.position?.length ? character.position.slice() : fallbackPosition.slice()
    const quaternion = character?.quaternion?.length ? character.quaternion.slice() : fallbackQuaternion.slice()
    return { position, quaternion }
  }

  async markLogin(characterId, timestamp = moment().toISOString()) {
    const character = await this.getCharacterById(characterId)
    if (!character) return
    character.lastLogin = timestamp
    character.updatedAt = timestamp
    await this.db('characters').where({ id: characterId }).update({ lastLogin: timestamp, updatedAt: timestamp })
  }

  async persistFromPlayer(player) {
    if (!player?.data?.characterId) return
    const character = await this.getCharacterById(player.data.characterId)
    if (!character) return
    const now = moment().toISOString()
    const position = player.data.position ? player.data.position.slice() : DEFAULT_POSITION.slice()
    const quaternion = player.data.quaternion ? player.data.quaternion.slice() : DEFAULT_QUATERNION.slice()
    const stats = { ...(character.stats ?? {}), ...(player.data.stats ?? {}) }
    if (typeof player.data.health === 'number') {
      stats.health = player.data.health
    }
    character.position = position
    character.quaternion = quaternion
    character.name = player.data.name ?? character.name
    character.level = player.data.level ?? character.level
    character.experience = player.data.experience ?? character.experience
    character.currency = player.data.currency ?? character.currency
    character.stats = stats
    character.updatedAt = now
    character.lastLogout = now
    await this.db('characters')
      .where({ id: character.id })
      .update({
        name: character.name,
        level: character.level,
        experience: character.experience,
        currency: character.currency,
        stats: JSON.stringify(stats ?? {}),
        position: JSON.stringify(position),
        quaternion: JSON.stringify(quaternion),
        updatedAt: now,
        lastLogout: now,
      })
  }

  applyEntityPatch(entity, patch) {
    if (!entity?.data?.characterId) return
    const character = this.charactersById.get(entity.data.characterId)
    if (!character) return
    const has = key => Object.prototype.hasOwnProperty.call(patch, key)
    if (has('name')) {
      character.name = patch.name
    }
    if (has('health')) {
      character.stats = character.stats ?? { ...DEFAULT_STATS }
      character.stats.health = patch.health
    }
    if (has('p')) {
      character.position = patch.p.slice()
    }
    if (has('q')) {
      character.quaternion = patch.q.slice()
    }
    if (has('stats')) {
      character.stats = { ...(character.stats ?? {}), ...patch.stats }
    }
    if (has('level')) {
      character.level = patch.level
    }
    if (has('experience')) {
      character.experience = patch.experience
    }
    if (has('currency')) {
      character.currency = patch.currency
    }
  }

  async updateCharacterName(characterId, name) {
    if (!characterId || !name) return
    const character = await this.getCharacterById(characterId)
    if (!character) return
    const now = moment().toISOString()
    character.name = name
    character.updatedAt = now
    await this.db('characters').where({ id: characterId }).update({ name, updatedAt: now })
  }

  async upsertInventoryItem(characterId, item) {
    if (!characterId || !item?.itemId) return null
    const now = moment().toISOString()
    const slot = item.slot ?? null
    let row = await this.db('character_inventories')
      .where({ characterId, itemId: item.itemId, slot })
      .first()
    if (row) {
      const quantity = item.quantity ?? row.quantity
      const metadata = JSON.stringify(item.metadata ?? safeParseJSON(row.metadata, {}))
      await this.db('character_inventories')
        .where({ id: row.id })
        .update({ quantity, metadata, updatedAt: now })
      row = { ...row, quantity, metadata, updatedAt: now }
    } else {
      const id = item.id ?? uuid()
      row = {
        id,
        characterId,
        itemId: item.itemId,
        slot,
        quantity: item.quantity ?? 1,
        metadata: JSON.stringify(item.metadata ?? {}),
        createdAt: now,
        updatedAt: now,
      }
      await this.db('character_inventories').insert(row)
    }
    const entry = mapInventoryRow(row)
    const character = await this.getCharacterById(characterId)
    if (character) {
      const index = character.inventory.findIndex(i => i.itemId === entry.itemId && i.slot === entry.slot)
      if (index >= 0) {
        character.inventory[index] = entry
      } else {
        character.inventory.push(entry)
      }
      character.updatedAt = now
    }
    return entry
  }

  async removeInventoryItem(characterId, itemId, slot = null) {
    if (!characterId || !itemId) return
    const row = await this.db('character_inventories')
      .where({ characterId, itemId, slot })
      .first()
    if (!row) return
    await this.db('character_inventories').where({ id: row.id }).delete()
    const character = await this.getCharacterById(characterId)
    if (character) {
      character.inventory = character.inventory.filter(item => !(item.itemId === itemId && item.slot === slot))
      character.updatedAt = moment().toISOString()
    }
  }

  async upsertQuestState(characterId, questId, data = {}) {
    if (!characterId || !questId) return null
    const now = moment().toISOString()
    let row = await this.db('character_quests')
      .where({ characterId, questId })
      .first()
    if (row) {
      const status = data.status ?? row.status
      const progress = JSON.stringify(data.progress ?? safeParseJSON(row.progress, {}))
      await this.db('character_quests')
        .where({ id: row.id })
        .update({ status, progress, updatedAt: now })
      row = { ...row, status, progress, updatedAt: now }
    } else {
      row = {
        id: uuid(),
        characterId,
        questId,
        status: data.status ?? 'active',
        progress: JSON.stringify(data.progress ?? {}),
        createdAt: now,
        updatedAt: now,
      }
      await this.db('character_quests').insert(row)
    }
    const entry = mapQuestRow(row)
    const character = await this.getCharacterById(characterId)
    if (character) {
      const index = character.quests.findIndex(quest => quest.questId === questId)
      if (index >= 0) {
        character.quests[index] = entry
      } else {
        character.quests.push(entry)
      }
      character.updatedAt = now
    }
    return entry
  }

  async removeQuest(characterId, questId) {
    if (!characterId || !questId) return
    const row = await this.db('character_quests').where({ characterId, questId }).first()
    if (!row) return
    await this.db('character_quests').where({ id: row.id }).delete()
    const character = await this.getCharacterById(characterId)
    if (character) {
      character.quests = character.quests.filter(quest => quest.questId !== questId)
      character.updatedAt = moment().toISOString()
    }
  }

  async #createCharacterRow(userId, name, spawn) {
    const now = moment().toISOString()
    const position = Array.isArray(spawn?.position) ? spawn.position.slice() : DEFAULT_POSITION.slice()
    const quaternion = Array.isArray(spawn?.quaternion) ? spawn.quaternion.slice() : DEFAULT_QUATERNION.slice()
    const row = {
      id: uuid(),
      userId,
      zoneId: this.zoneId,
      name,
      level: 1,
      experience: 0,
      currency: 0,
      stats: JSON.stringify({ ...DEFAULT_STATS }),
      position: JSON.stringify(position),
      quaternion: JSON.stringify(quaternion),
      createdAt: now,
      updatedAt: now,
      lastLogin: now,
      lastLogout: null,
    }
    await this.db('characters').insert(row)
    return row
  }

  async #hydrateFromRow(row) {
    const character = {
      id: row.id,
      userId: row.userId,
      zoneId: row.zoneId,
      name: row.name,
      level: row.level,
      experience: row.experience,
      currency: row.currency,
      stats: safeParseJSON(row.stats, DEFAULT_STATS),
      position: safeParseJSON(row.position, DEFAULT_POSITION),
      quaternion: safeParseJSON(row.quaternion, DEFAULT_QUATERNION),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastLogin: row.lastLogin,
      lastLogout: row.lastLogout,
      inventory: [],
      quests: [],
    }
    const inventoryRows = await this.db('character_inventories')
      .where({ characterId: character.id })
      .orderBy('createdAt', 'asc')
    character.inventory = inventoryRows.map(mapInventoryRow)
    const questRows = await this.db('character_quests')
      .where({ characterId: character.id })
      .orderBy('createdAt', 'asc')
    character.quests = questRows.map(mapQuestRow)
    return character
  }

  #cacheCharacter(character) {
    this.charactersById.set(character.id, character)
    this.charactersByUserId.set(character.userId, character)
  }
}
