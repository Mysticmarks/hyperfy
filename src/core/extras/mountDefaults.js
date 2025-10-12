export const DEFAULT_MOUNTS = [
  {
    id: 'sojourner-strider',
    name: 'Sojourner Strider',
    description: 'A sure-footed land mount bred to carry riders over rugged terrain.',
    appearance: {
      type: 'model',
      url: 'asset://mount-strider.glb',
      scale: 1.4,
      height: 1.9,
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
      tags: ['ground', 'exploration'],
      default: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  },
  {
    id: 'tidal-glider',
    name: 'Tidal Glider',
    description: 'An amphibious mount that slips seamlessly between rivers and shoreline.',
    appearance: {
      type: 'model',
      url: 'asset://mount-glider.glb',
      scale: 1.2,
      height: 1.4,
    },
    movement: {
      walk: true,
      swim: true,
      fly: false,
    },
    seating: [
      { id: 'pilot', type: 'player', label: 'Navigator', required: true },
      { id: 'wingmate', type: 'companion', label: 'Wingmate', required: false },
    ],
    metadata: {
      rarity: 'rare',
      tags: ['water', 'amphibious'],
      default: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  },
  {
    id: 'skysteer-ram',
    name: 'Skysteer Ram',
    description: 'A soaring companion mount capable of carrying riders across the clouds.',
    appearance: {
      type: 'model',
      url: 'asset://mount-skysteer.glb',
      scale: 1.5,
      height: 2.1,
    },
    movement: {
      walk: true,
      swim: false,
      fly: true,
    },
    seating: [
      { id: 'pilot', type: 'player', label: 'Captain', required: true },
      { id: 'scout', type: 'companion', label: 'Scout', required: false },
    ],
    metadata: {
      rarity: 'epic',
      tags: ['air', 'flight'],
      default: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  },
]
