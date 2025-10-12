import { clamp } from '../utils'
import { prng } from './prng'

const DEFAULT_SEED_OFFSET = 7919
const FLOAT_SCALE = 1_000_000

const BIOMES = [
  {
    id: 'emberforge',
    name: 'Ember Forge',
    weight: 1,
    tags: ['fire', 'industrial'],
    hazardBias: ['lava geysers', 'molten rivers', 'heat vents'],
    encounterBias: ['siege constructs', 'ember cultists'],
    lootTags: ['fire', 'armor'],
    difficultyMultiplier: 1.05,
  },
  {
    id: 'mistvale',
    name: 'Mistvale Ruins',
    weight: 1,
    tags: ['arcane', 'mystic'],
    hazardBias: ['phase rifts', 'arcane storms', 'gravity wells'],
    encounterBias: ['void shades', 'spellbound guardians'],
    lootTags: ['arcane', 'focus'],
    difficultyMultiplier: 1,
  },
  {
    id: 'thornhollow',
    name: 'Thornhollow Wilds',
    weight: 0.9,
    tags: ['nature', 'poison'],
    hazardBias: ['toxic blooms', 'razor vines', 'spore clouds'],
    encounterBias: ['feral guardians', 'toxin weavers'],
    lootTags: ['nature', 'resistance'],
    difficultyMultiplier: 0.95,
  },
  {
    id: 'dawnspire',
    name: 'Dawnspire Bastion',
    weight: 0.8,
    tags: ['light', 'aerial'],
    hazardBias: ['solar flares', 'wind shear', 'fractured platforms'],
    encounterBias: ['skyward zealots', 'auric sentries'],
    lootTags: ['light', 'mobility'],
    difficultyMultiplier: 1.1,
  },
  {
    id: 'deepcurrent',
    name: 'Deepcurrent Trench',
    weight: 0.85,
    tags: ['water', 'pressure'],
    hazardBias: ['tidal surges', 'pressure spikes', 'bio-lum snares'],
    encounterBias: ['abyss leviathans', 'current wardens'],
    lootTags: ['water', 'adaptation'],
    difficultyMultiplier: 1.15,
  },
]

const GLOBAL_MODIFIERS = [
  {
    id: 'low_gravity',
    name: 'Low Gravity',
    description: 'Movement is floaty and aerial control is reduced.',
    impact: { traversal: 0.6, combat: 0.2 },
  },
  {
    id: 'arcane_flux',
    name: 'Arcane Flux',
    description: 'Skill cooldowns are unstable but ultimate abilities charge faster.',
    impact: { combat: 0.8, puzzle: 0.5 },
  },
  {
    id: 'volatile_fauna',
    name: 'Volatile Fauna',
    description: 'Ambient wildlife reacts aggressively to noise and energy spikes.',
    impact: { combat: 0.7, traversal: 0.4 },
  },
  {
    id: 'shadow_mist',
    name: 'Shadow Mist',
    description: 'Visibility is reduced and illusions lurk at the periphery of vision.',
    impact: { combat: 0.9, puzzle: 0.6 },
  },
  {
    id: 'temporal_spikes',
    name: 'Temporal Spikes',
    description: 'Time dilation pulses alter the rhythm of encounters unpredictably.',
    impact: { combat: 1, traversal: 0.3 },
  },
]

const ROOM_TEMPLATES = [
  {
    id: 'entrance',
    name: 'Threshold Antechamber',
    category: 'entrance',
    baseDifficulty: 0,
    tags: ['intro'],
  },
  {
    id: 'arena',
    name: 'Confrontation Arena',
    category: 'combat',
    baseDifficulty: 1,
    tags: ['combat'],
  },
  {
    id: 'gauntlet',
    name: 'Hazard Gauntlet',
    category: 'hazard',
    baseDifficulty: 1.2,
    tags: ['traversal', 'trap'],
  },
  {
    id: 'puzzle',
    name: 'Puzzle Core',
    category: 'puzzle',
    baseDifficulty: 1,
    tags: ['puzzle'],
  },
  {
    id: 'sanctum',
    name: 'Boss Sanctum',
    category: 'boss',
    baseDifficulty: 1.6,
    tags: ['combat', 'boss'],
  },
]

const ENCOUNTER_TEMPLATES = {
  entrance: [
    {
      id: 'scouting_party',
      name: 'Scouting Party',
      difficultyBias: 0.6,
      description: 'Light resistance to probe intruders.',
    },
    {
      id: 'guardian_echoes',
      name: 'Dormant Guardian Echoes',
      difficultyBias: 0.8,
      description: 'Echoes of prior challengers linger in spectral form.',
    },
  ],
  combat: [
    {
      id: 'skirmish_wave',
      name: 'Coordinated Skirmish',
      difficultyBias: 1,
      description: 'Mixed-range opponents with coordinated tactics.',
    },
    {
      id: 'siege_break',
      name: 'Siege Breakers',
      difficultyBias: 1.2,
      description: 'Heavily armored units supported by disruptors.',
    },
    {
      id: 'apex_predators',
      name: 'Apex Predator Pack',
      difficultyBias: 1.3,
      description: 'Fast-moving predators with bleed effects.',
    },
  ],
  hazard: [
    {
      id: 'timed_spires',
      name: 'Timed Spire Circuit',
      difficultyBias: 1,
      description: 'Navigate pulsing hazards before the chamber locks down.',
    },
    {
      id: 'pressure_maze',
      name: 'Pressure Maze',
      difficultyBias: 1.1,
      description: 'Shifting walls and crushing plates force precise timing.',
    },
  ],
  puzzle: [
    {
      id: 'resonance_lock',
      name: 'Resonance Locks',
      difficultyBias: 0.9,
      description: 'Synchronise energy nodes to open the path forward.',
    },
    {
      id: 'sigil_rotation',
      name: 'Sigil Rotation',
      difficultyBias: 1,
      description: 'Align rotating glyphs while under intermittent pressure.',
    },
  ],
  boss: [
    {
      id: 'boss_gauntlet',
      name: 'Boss Prelude',
      difficultyBias: 1.4,
      description: 'Final staging area leading into the miniboss sanctum.',
    },
  ],
}

const MINIBOSS_TEMPLATES = [
  {
    id: 'ember_colossus',
    name: 'Ember Colossus',
    archetype: 'brute',
    tags: ['fire', 'industrial'],
    baseStats: { health: 1400, damage: 42, defense: 24 },
    abilities: ['Molten Hammerfall', 'Lava Shockwave', 'Smoldering Core'],
    lootBias: ['fire', 'armor'],
    difficulty: 2.4,
  },
  {
    id: 'rift_chanteur',
    name: 'Rift Chanteur',
    archetype: 'caster',
    tags: ['arcane', 'mystic'],
    baseStats: { health: 1100, damage: 48, defense: 18 },
    abilities: ['Resonant Beam', 'Void Chorus', 'Spatial Fold'],
    lootBias: ['arcane', 'focus'],
    difficulty: 2.6,
  },
  {
    id: 'thorn_sovereign',
    name: 'Thorn Sovereign',
    archetype: 'controller',
    tags: ['nature', 'poison'],
    baseStats: { health: 1250, damage: 38, defense: 26 },
    abilities: ['Spore Overgrowth', 'Piercing Roots', 'Toxic Bloom'],
    lootBias: ['nature', 'resistance'],
    difficulty: 2.2,
  },
  {
    id: 'auric_sentinel',
    name: 'Auric Sentinel',
    archetype: 'warden',
    tags: ['light', 'aerial'],
    baseStats: { health: 1300, damage: 41, defense: 28 },
    abilities: ['Radiant Spear', 'Solar Ward', 'Skyward Judgement'],
    lootBias: ['light', 'mobility'],
    difficulty: 2.5,
  },
  {
    id: 'abyss_conductor',
    name: 'Abyss Conductor',
    archetype: 'tactician',
    tags: ['water', 'pressure'],
    baseStats: { health: 1350, damage: 44, defense: 22 },
    abilities: ['Pressure Crush', 'Tidal Overrun', 'Hadopelagic Pulse'],
    lootBias: ['water', 'adaptation'],
    difficulty: 2.7,
  },
]

const MINIBOSS_MUTATIONS = [
  {
    id: 'enraged',
    name: 'Enraged',
    description: 'Increases outgoing damage as health drops.',
    modifiers: { damage: 0.18 },
  },
  {
    id: 'phase_shifter',
    name: 'Phase Shifter',
    description: 'Short bursts of invulnerability following abilities.',
    modifiers: { defense: 0.22 },
  },
  {
    id: 'summoner',
    name: 'Summoner',
    description: 'Periodically summons elite reinforcements.',
    modifiers: { difficulty: 0.3 },
  },
  {
    id: 'aegis',
    name: 'Adaptive Aegis',
    description: 'Adapts resistance to the most used damage type.',
    modifiers: { defense: 0.3 },
  },
  {
    id: 'chronal',
    name: 'Chronal Anomaly',
    description: 'Manipulates time to rewind minor injuries.',
    modifiers: { health: 0.2 },
  },
]

const BASE_LOOT_POOLS = {
  common: [
    {
      id: 'anima_fragment',
      name: 'Anima Fragment',
      type: 'material',
      tags: ['resource', 'crafting'],
      weight: 6,
      valueRange: [12, 20],
    },
    {
      id: 'runic_scrap',
      name: 'Runic Scrap',
      type: 'material',
      tags: ['crafting'],
      weight: 5,
      valueRange: [15, 24],
    },
    {
      id: 'healing_vapor',
      name: 'Stabilising Vapor',
      type: 'consumable',
      tags: ['support'],
      weight: 4,
      valueRange: [18, 28],
    },
  ],
  uncommon: [
    {
      id: 'refined_core',
      name: 'Refined Core',
      type: 'material',
      tags: ['crafting', 'upgrade'],
      weight: 4,
      valueRange: [32, 48],
    },
    {
      id: 'charged_capacitor',
      name: 'Charged Capacitor',
      type: 'component',
      tags: ['tech'],
      weight: 3,
      valueRange: [40, 55],
    },
    {
      id: 'recovery_totem',
      name: 'Recovery Totem',
      type: 'consumable',
      tags: ['support'],
      weight: 3,
      valueRange: [36, 54],
    },
  ],
  rare: [
    {
      id: 'prismatic_matrix',
      name: 'Prismatic Matrix',
      type: 'component',
      tags: ['arcane', 'tech'],
      weight: 2,
      valueRange: [72, 110],
    },
    {
      id: 'adaptive_plating',
      name: 'Adaptive Plating',
      type: 'armor',
      tags: ['defense'],
      weight: 2,
      valueRange: [90, 120],
    },
    {
      id: 'essence_spindle',
      name: 'Essence Spindle',
      type: 'material',
      tags: ['upgrade'],
      weight: 2,
      valueRange: [80, 130],
    },
  ],
  legendary: [
    {
      id: 'chronicle_shard',
      name: 'Chronicle Shard',
      type: 'artifact',
      tags: ['legendary', 'arcane'],
      weight: 1,
      valueRange: [180, 260],
    },
    {
      id: 'phoenix_engine',
      name: 'Phoenix Engine',
      type: 'artifact',
      tags: ['legendary', 'fire'],
      weight: 1,
      valueRange: [200, 280],
    },
  ],
}

const BIOME_LOOT_BONUS = {
  emberforge: {
    rare: [
      {
        id: 'furnace_hearth',
        name: 'Furnace Hearth Core',
        type: 'component',
        tags: ['fire', 'armor'],
        weight: 1.6,
        valueRange: [110, 160],
      },
    ],
    legendary: [
      {
        id: 'volcanic_reactor',
        name: 'Volcanic Reactor Heart',
        type: 'artifact',
        tags: ['fire', 'power'],
        weight: 1.2,
        valueRange: [220, 320],
      },
    ],
  },
  mistvale: {
    uncommon: [
      {
        id: 'riftthread',
        name: 'Riftthread Filament',
        type: 'material',
        tags: ['arcane'],
        weight: 1.5,
        valueRange: [48, 66],
      },
    ],
    rare: [
      {
        id: 'echo_focus',
        name: 'Echo Focus Prism',
        type: 'focus',
        tags: ['arcane', 'focus'],
        weight: 1.3,
        valueRange: [95, 135],
      },
    ],
  },
  thornhollow: {
    uncommon: [
      {
        id: 'spore_infuser',
        name: 'Spore Infuser',
        type: 'consumable',
        tags: ['nature', 'poison'],
        weight: 1.4,
        valueRange: [44, 70],
      },
    ],
    rare: [
      {
        id: 'thornmantle',
        name: 'Thornmantle Harness',
        type: 'armor',
        tags: ['nature', 'resistance'],
        weight: 1.2,
        valueRange: [88, 130],
      },
    ],
  },
  dawnspire: {
    rare: [
      {
        id: 'auric_wings',
        name: 'Auric Wing Frames',
        type: 'mobility',
        tags: ['light', 'mobility'],
        weight: 1.2,
        valueRange: [100, 150],
      },
    ],
    legendary: [
      {
        id: 'sunlance',
        name: 'Sunlance Core',
        type: 'weapon',
        tags: ['light', 'legendary'],
        weight: 1.1,
        valueRange: [230, 330],
      },
    ],
  },
  deepcurrent: {
    uncommon: [
      {
        id: 'tidal_conduct',
        name: 'Tidal Conduit',
        type: 'component',
        tags: ['water', 'tech'],
        weight: 1.3,
        valueRange: [50, 72],
      },
    ],
    rare: [
      {
        id: 'abyssal_plate',
        name: 'Abyssal Pressure Plate',
        type: 'armor',
        tags: ['water', 'adaptation'],
        weight: 1.2,
        valueRange: [92, 140],
      },
    ],
  },
}

const DEFAULT_LOOT_BLUEPRINT = {
  rolls: {
    base: 3,
    bonus: 0,
    perPlayer: 0.35,
    performanceScale: 1.2,
  },
  currency: {
    min: 60,
    max: 110,
    scale: 1,
  },
  rarityWeights: {
    common: 52,
    uncommon: 32,
    rare: 13,
    legendary: 3,
  },
  rarityTuning: {
    performance: {
      common: -0.18,
      uncommon: 0.08,
      rare: 0.28,
      legendary: 0.42,
    },
    luck: {
      common: -0.12,
      uncommon: 0.05,
      rare: 0.22,
      legendary: 0.35,
    },
  },
  bias: {
    tags: [],
    weightBoost: 0.35,
  },
}

function createRandom(seed = Date.now() + DEFAULT_SEED_OFFSET) {
  const randInt = prng(Math.abs(Math.floor(seed)))
  const randomInt = (min, max) => {
    if (min === max) return min
    return randInt(min, max)
  }
  return {
    int(min, max) {
      return randomInt(min, max)
    },
    float(min = 0, max = 1) {
      const value = randomInt(0, FLOAT_SCALE)
      const normalized = value / FLOAT_SCALE
      return min + (max - min) * normalized
    },
    pick(array) {
      if (!array?.length) return null
      const index = array.length === 1 ? 0 : randomInt(0, array.length - 1)
      return array[index]
    },
    shuffle(list) {
      const array = Array.from(list)
      for (let i = array.length - 1; i > 0; i--) {
        const j = randomInt(0, i)
        ;[array[i], array[j]] = [array[j], array[i]]
      }
      return array
    },
  }
}

function ensureArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function weightedPick(random, entries, fallback = null) {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight ?? 0), 0)
  if (total <= 0) {
    return fallback
  }
  const roll = random.float(0, total)
  let acc = 0
  for (const entry of entries) {
    const weight = Math.max(0, entry.weight ?? 0)
    acc += weight
    if (roll <= acc) {
      return entry.item
    }
  }
  return entries.length ? entries[entries.length - 1].item : fallback
}

function rollRange(random, min, max) {
  if (min === max) return min
  return random.float(min, max)
}

function scoreBias(tags, biasSet) {
  if (!biasSet.size || !tags?.length) return 0
  let score = 0
  for (const tag of tags) {
    if (biasSet.has(tag)) score++
  }
  return score
}

function buildLootPools(biomeId) {
  const pools = {}
  for (const rarity of Object.keys(BASE_LOOT_POOLS)) {
    const basePool = BASE_LOOT_POOLS[rarity] ?? []
    const biomePool = BIOME_LOOT_BONUS[biomeId]?.[rarity] ?? []
    pools[rarity] = [...basePool, ...biomePool].map(item => ({ ...item }))
  }
  return pools
}

function pickBiome(random, themeBias) {
  const biasSet = new Set(ensureArray(themeBias).filter(Boolean))
  const entries = BIOMES.map(biome => {
    const tags = new Set([biome.id, ...(biome.tags ?? [])])
    let weight = biome.weight ?? 1
    for (const tag of biasSet) {
      if (tags.has(tag)) weight *= 1.6
    }
    return { item: biome, weight }
  })
  const fallback = BIOMES[0]
  return weightedPick(random, entries, fallback)
}

function pickHazard(random, biome, hazardBias) {
  const combinedBias = new Set([...ensureArray(biome?.hazardBias), ...ensureArray(hazardBias)])
  const hazards = ensureArray(biome?.hazardBias ?? ['arcane burst'])
  const expanded = hazards.length ? hazards : ['arcane burst']
  const entries = expanded.map(hazard => {
    const tags = ensureArray(hazard)
    let weight = 1
    for (const tag of tags) {
      if (combinedBias.has(tag)) weight += 0.4
    }
    return { item: hazard, weight }
  })
  return weightedPick(random, entries, expanded[0])
}

function pickEncounter(random, template, difficulty, biome) {
  const category = template?.category ?? 'combat'
  const entries = (ENCOUNTER_TEMPLATES[category] ?? ENCOUNTER_TEMPLATES.combat).map(encounter => {
    let weight = encounter.difficultyBias ?? 1
    if (biome?.encounterBias?.some(tag => encounter.id.includes(tag.split(' ')[0]))) {
      weight *= 1.25
    }
    weight *= clamp(1 + (difficulty - 1) * 0.1, 0.5, 2)
    return { item: encounter, weight }
  })
  return weightedPick(random, entries, ENCOUNTER_TEMPLATES[category]?.[0])
}

function pickEncounterTemplate(random, difficulty, branchFactor) {
  const options = ROOM_TEMPLATES.filter(room => room.id !== 'entrance' && room.category !== 'boss')
  const entries = options.map(room => {
    let weight = room.baseDifficulty <= difficulty ? 1.2 : 0.9
    if (room.category === 'puzzle') {
      weight *= clamp(1 + (branchFactor - 2) * 0.2, 0.6, 1.6)
    }
    return { item: room, weight }
  })
  return weightedPick(random, entries, options[0])
}

function buildRewardHint(category, difficulty) {
  if (category === 'combat') {
    return difficulty > 3 ? 'High-tier combat reward cache' : 'Standard combat cache'
  }
  if (category === 'hazard') {
    return 'Traversal reward with crafting focus'
  }
  if (category === 'puzzle') {
    return 'Puzzle cache – expect support-focused loot'
  }
  return 'Mixed rewards'
}

function generateRooms(random, options) {
  const { depth, branchFactor, difficulty, biome, hazardBias } = options
  const rooms = []
  let previousLayer = []

  for (let layer = 0; layer < depth; layer++) {
    const roomBudget = Math.max(1, Math.round(branchFactor + random.float(-0.4, 0.6)))
    const layerRooms = []
    for (let index = 0; index < roomBudget; index++) {
      const template = layer === 0
        ? ROOM_TEMPLATES.find(room => room.id === 'entrance')
        : pickEncounterTemplate(random, difficulty, branchFactor)
      const hazard = pickHazard(random, biome, hazardBias)
      const encounter = pickEncounter(random, template, difficulty, biome)
      const id = `${template.id}-${layer}-${index}-${random.int(0, 9999)}`
      const connectors = layer === 0
        ? []
        : ensureArray(random.pick(previousLayer)?.id).filter(Boolean)
      const roomDifficulty = clamp(
        template.baseDifficulty + (difficulty - 1) * 0.35 + (layer * 0.12),
        0.5,
        5
      )
      layerRooms.push({
        id,
        name: template.name,
        type: template.category,
        layer,
        connectors,
        hazard,
        encounter: {
          id: encounter.id,
          name: encounter.name,
          description: encounter.description,
          challengeRating: clamp(encounter.difficultyBias * roomDifficulty, 0.4, 6),
        },
        rewardHint: buildRewardHint(template.category, difficulty),
      })
    }
    rooms.push(...layerRooms)
    previousLayer = layerRooms
  }

  const bossTemplate = ROOM_TEMPLATES.find(room => room.category === 'boss')
  const bossHazard = pickHazard(random, biome, hazardBias)
  const bossEncounter = pickEncounter(random, bossTemplate, difficulty + 0.6, biome)
  const bossRoom = {
    id: `boss-sanctum-${random.int(0, 9999)}`,
    name: `${biome.name} Sanctum`,
    type: 'boss',
    layer: depth,
    connectors: previousLayer.map(room => room.id),
    hazard: bossHazard,
    encounter: {
      id: bossEncounter.id,
      name: bossEncounter.name,
      description: bossEncounter.description,
      challengeRating: clamp(bossEncounter.difficultyBias * (difficulty + 0.8), 1, 8),
    },
    rewardHint: 'Guaranteed miniboss cache',
  }
  rooms.push(bossRoom)

  return rooms
}

function applyMutations(random, template, mutationCount) {
  const available = random.shuffle(MINIBOSS_MUTATIONS)
  const applied = available.slice(0, mutationCount)
  const stats = { ...template.baseStats }
  let difficulty = template.difficulty
  for (const mutation of applied) {
    if (mutation.modifiers.health) {
      stats.health = Math.round(stats.health * (1 + mutation.modifiers.health))
    }
    if (mutation.modifiers.damage) {
      stats.damage = Math.round(stats.damage * (1 + mutation.modifiers.damage))
    }
    if (mutation.modifiers.defense) {
      stats.defense = Math.round(stats.defense * (1 + mutation.modifiers.defense))
    }
    if (mutation.modifiers.difficulty) {
      difficulty += mutation.modifiers.difficulty
    }
  }
  return {
    stats,
    difficulty,
    mutations: applied.map(mutation => ({ id: mutation.id, name: mutation.name, description: mutation.description })),
  }
}

function generateMiniboss(random, options) {
  const { biome, difficulty, archetypeBias = [], mutationCount = 2, statScale = 1 } = options
  const biasSet = new Set(ensureArray(archetypeBias))
  const biomeTags = new Set([biome.id, ...(biome.tags ?? [])])
  const entries = MINIBOSS_TEMPLATES.map(template => {
    let weight = 1
    const templateTags = new Set(template.tags ?? [])
    let overlap = 0
    for (const tag of templateTags) {
      if (biomeTags.has(tag)) overlap++
    }
    if (overlap > 0) {
      weight *= 1 + overlap * 0.45
    }
    if (biasSet.has(template.archetype)) {
      weight *= 1.5
    }
    const diffDelta = Math.abs(template.difficulty - difficulty)
    weight *= clamp(1.4 - diffDelta * 0.35, 0.4, 1.6)
    return { item: template, weight }
  })
  const template = weightedPick(random, entries, MINIBOSS_TEMPLATES[0])
  const applied = applyMutations(random, template, clamp(Math.round(mutationCount), 0, MINIBOSS_MUTATIONS.length))
  const stats = {
    health: Math.round(applied.stats.health * statScale),
    damage: Math.round(applied.stats.damage * statScale),
    defense: Math.round(applied.stats.defense * statScale),
  }
  return {
    id: template.id,
    name: template.name,
    archetype: template.archetype,
    tags: template.tags,
    abilities: template.abilities,
    stats,
    difficultyRating: applied.difficulty * clamp(statScale, 0.6, 1.8),
    lootBias: template.lootBias,
    mutations: applied.mutations,
  }
}

function mergeBiasTags(...groups) {
  const set = new Set()
  for (const group of groups) {
    for (const value of ensureArray(group)) {
      if (value) set.add(value)
    }
  }
  return Array.from(set)
}

function createLootBlueprint(random, options) {
  const { biome, difficulty, lootProfile = {}, miniboss } = options
  const blueprint = JSON.parse(JSON.stringify(DEFAULT_LOOT_BLUEPRINT))
  blueprint.rolls.base = clamp(
    Math.round(blueprint.rolls.base + (difficulty - 1) * 0.7 + (lootProfile.bonusRolls ?? 0)),
    1,
    10
  )
  blueprint.rolls.performanceScale = clamp(blueprint.rolls.performanceScale + (lootProfile.performanceScale ?? 0), 0.5, 2)
  blueprint.rolls.perPlayer = clamp(blueprint.rolls.perPlayer + (lootProfile.perPlayer ?? 0), 0, 1)
  blueprint.rolls.bonus = clamp((lootProfile.flatBonus ?? 0) + blueprint.rolls.bonus, 0, 6)
  blueprint.currency = {
    min: Math.round(blueprint.currency.min * clamp(1 + (lootProfile.currencyScale ?? 0), 0.5, 2)),
    max: Math.round(blueprint.currency.max * clamp(1 + (lootProfile.currencyScale ?? 0), 0.5, 2.5)),
    scale: blueprint.currency.scale,
  }

  const rarityBias = lootProfile.rarityBias ?? {}
  for (const rarity of Object.keys(blueprint.rarityWeights)) {
    const shift = rarityBias[rarity] ?? 0
    const scale = 1 + (difficulty - 1) * (rarity === 'legendary' ? 0.25 : rarity === 'rare' ? 0.18 : rarity === 'uncommon' ? 0.12 : -0.1)
    const adjusted = blueprint.rarityWeights[rarity] * clamp(scale + shift, 0.2, 2.5)
    blueprint.rarityWeights[rarity] = Math.max(0, adjusted)
  }

  blueprint.bias.tags = mergeBiasTags(biome.lootTags, miniboss?.lootBias, lootProfile.tagBias)
  if (lootProfile.weightBoost) {
    blueprint.bias.weightBoost = clamp(lootProfile.weightBoost, 0, 1.5)
  }
  blueprint.itemPools = buildLootPools(biome.id)
  return blueprint
}

function estimateLootPreview(blueprint) {
  const totalWeight = Object.values(blueprint.rarityWeights).reduce((sum, weight) => sum + weight, 0)
  const rarityPreview = {}
  for (const [rarity, weight] of Object.entries(blueprint.rarityWeights)) {
    rarityPreview[rarity] = totalWeight > 0 ? weight / totalWeight : 0
  }
  return {
    rolls: blueprint.rolls.base + blueprint.rolls.bonus,
    rarityDistribution: rarityPreview,
    biasTags: blueprint.bias.tags,
  }
}

function generateChallengeLevel(options = {}) {
  const {
    seed = Date.now(),
    depth = 3,
    branchFactor = 3,
    difficulty = 2.5,
    themeBias = [],
    hazardBias = [],
    minibossProfile = {},
    lootProfile = {},
  } = options
  const random = createRandom(seed)
  const resolvedDifficulty = clamp(difficulty, 1, 5)
  const resolvedDepth = clamp(Math.round(depth), 2, 6)
  const resolvedBranch = clamp(branchFactor, 1.5, 4.5)
  const biome = pickBiome(random, themeBias)
  const modifiers = random.shuffle(GLOBAL_MODIFIERS).slice(0, Math.max(1, Math.round(resolvedDifficulty / 2)))
  const rooms = generateRooms(random, {
    depth: resolvedDepth,
    branchFactor: resolvedBranch,
    difficulty: resolvedDifficulty * (biome.difficultyMultiplier ?? 1),
    biome,
    hazardBias,
  })
  const miniboss = generateMiniboss(random, {
    biome,
    difficulty: resolvedDifficulty * (biome.difficultyMultiplier ?? 1),
    archetypeBias: minibossProfile.archetypeBias,
    mutationCount: minibossProfile.mutationCount ?? 2,
    statScale: minibossProfile.statScale ?? clamp(1 + (resolvedDifficulty - 2.5) * 0.18, 0.8, 1.6),
  })
  const lootBlueprint = createLootBlueprint(random, {
    biome,
    difficulty: resolvedDifficulty,
    lootProfile,
    miniboss,
  })

  return {
    seed,
    depth: resolvedDepth,
    branchFactor: resolvedBranch,
    difficulty: resolvedDifficulty,
    biome: {
      id: biome.id,
      name: biome.name,
      tags: biome.tags,
      hazardHints: biome.hazardBias,
    },
    modifiers: modifiers.map(modifier => ({
      id: modifier.id,
      name: modifier.name,
      description: modifier.description,
      impact: modifier.impact,
    })),
    layout: rooms,
    miniboss,
    loot: {
      blueprint: lootBlueprint,
      preview: estimateLootPreview(lootBlueprint),
    },
    analytics: {
      estimatedDuration: Math.round(18 + resolvedDepth * 6 + resolvedBranch * 4),
      threatRating: clamp(miniboss.difficultyRating + resolvedDifficulty * 0.5, 1, 10),
      recommendedPower: Math.round(120 + resolvedDifficulty * 35 + miniboss.difficultyRating * 15),
    },
  }
}

function rollRarity(random, blueprint, performance = 1, luck = 0) {
  const entries = []
  for (const [rarity, weight] of Object.entries(blueprint.rarityWeights)) {
    let adjusted = weight
    if (performance !== 1) {
      const perfModifier = blueprint.rarityTuning.performance?.[rarity] ?? 0
      adjusted *= 1 + (performance - 1) * perfModifier
    }
    if (luck !== 0) {
      const luckModifier = blueprint.rarityTuning.luck?.[rarity] ?? 0
      adjusted *= 1 + luck * luckModifier
    }
    entries.push({ item: rarity, weight: Math.max(0, adjusted) })
  }
  return weightedPick(random, entries, 'common')
}

function rollItem(random, pool, biasTags, weightBoost, extraBias = []) {
  if (!pool?.length) return null
  const biasSet = new Set([...biasTags, ...extraBias])
  const entries = pool.map(item => {
    let weight = item.weight ?? 1
    const biasScore = scoreBias(item.tags, biasSet)
    if (biasScore > 0) {
      weight *= 1 + biasScore * weightBoost
    }
    return { item, weight }
  })
  return weightedPick(random, entries, pool[0])
}

function generateLootDrops(options = {}) {
  const {
    seed = Date.now() + DEFAULT_SEED_OFFSET,
    blueprint,
    difficulty = 2.5,
    performance = 1,
    luck = 0,
    bonusRolls = 0,
    playerCount = 1,
    extraBiasTags = [],
  } = options
  if (!blueprint) {
    throw new Error('[proceduralChallenges] Missing loot blueprint')
  }
  const random = createRandom(seed)
  const rollBase = blueprint.rolls.base + blueprint.rolls.bonus
  const performanceBonus = Math.max(0, performance - 1) * blueprint.rolls.performanceScale
  const partyBonus = Math.max(0, playerCount - 1) * blueprint.rolls.perPlayer
  const totalRolls = clamp(Math.round(rollBase + performanceBonus + partyBonus + bonusRolls), 1, 12)
  const items = []
  const rarityCounts = {
    common: 0,
    uncommon: 0,
    rare: 0,
    legendary: 0,
  }
  for (let i = 0; i < totalRolls; i++) {
    const rarity = rollRarity(random, blueprint, performance, luck)
    rarityCounts[rarity] = (rarityCounts[rarity] ?? 0) + 1
    const pool = blueprint.itemPools?.[rarity] ?? []
    const item = rollItem(random, pool, blueprint.bias.tags ?? [], blueprint.bias.weightBoost ?? 0.25, extraBiasTags)
    if (!item) continue
    const value = Math.round(
      rollRange(random, item.valueRange?.[0] ?? 10, item.valueRange?.[1] ?? 20) *
        clamp(1 + (difficulty - 1) * 0.18 + (performance - 1) * 0.22, 0.6, 3)
    )
    items.push({
      id: item.id,
      name: item.name,
      type: item.type,
      tags: item.tags,
      rarity,
      value,
    })
  }

  const currencyBase = rollRange(random, blueprint.currency.min, blueprint.currency.max)
  const currency = Math.round(
    currencyBase * clamp(1 + (difficulty - 1) * 0.15 + (performance - 1) * 0.25 + luck * 0.1, 0.5, 4)
  )

  const totalValue = items.reduce((sum, entry) => sum + entry.value, 0) + currency

  return {
    seed,
    rolls: totalRolls,
    items,
    currency,
    rarityCounts,
    totalValue,
    summary: {
      currency,
      rolls: totalRolls,
      rarityCounts,
      totalValue,
    },
  }
}

export {
  generateChallengeLevel,
  generateLootDrops,
  mergeBiasTags,
}
