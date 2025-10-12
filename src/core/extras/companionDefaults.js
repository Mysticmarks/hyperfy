export const DEFAULT_COMPANIONS = [
  {
    id: 'skyward-warden',
    name: 'Starling',
    title: 'Skyward Warden',
    persona:
      'An encouraging, witty guardian spirit who keeps morale high while scouting the skies for danger. Speaks with curiosity and optimism.',
    archetype: 'Aerial Sentinel',
    appearance: {
      type: 'avatar',
      url: 'asset://avatar.vrm',
      scale: 1,
      tint: '#8cf0ff',
      idleAnimation: 'Idle',
      locomotionSet: 'avian',
    },
    locomotion: {
      walk: true,
      swim: false,
      fly: true,
      hover: true,
      dig: false,
    },
    behavior: {
      followDistance: 2.6,
      followHeight: 0.8,
      followResponsiveness: 3.4,
      tetherRadius: 16,
      idleOrbit: true,
      idleOrbitRadius: 1.2,
      idleOrbitSpeed: 0.55,
      manualTimeout: 2.8,
      movementSpeed: 3.4,
    },
    skills: [
      {
        id: 'gust-lift',
        name: 'Gust Lift',
        description: 'Summons a spiral of wind that lifts foes into the air, interrupting their attacks.',
        cooldown: 8,
        tags: ['crowd-control', 'air'],
      },
      {
        id: 'aerial-ward',
        name: 'Aerial Ward',
        description: 'Wraps the player in a shimmering barrier that absorbs incoming damage for a short time.',
        cooldown: 15,
        tags: ['support', 'defense'],
      },
      {
        id: 'zephyr-mark',
        name: 'Zephyr Mark',
        description: 'Marks an enemy, increasing the player’s damage against it while Starling harasses from above.',
        cooldown: 20,
        tags: ['support', 'debuff'],
      },
    ],
    instructions: {
      chat:
        'Be conversational and upbeat. Offer insights about the surroundings, tactically prompt the player with options, and maintain an encouraging tone.',
      combat:
        'Prioritize protecting the player, interrupting dangerous attacks, and calling out threats. Coordinate aerial assaults and maintain positional advantage.',
      exploration:
        'Scout vertical spaces, point out secrets, and suggest vantage points. Offer lore snippets and environmental storytelling when available.',
    },
    llm: {
      prompt:
        'You are Starling, an aerial warden companion in a fantasy MMO. Speak like a close friend and tactician. Offer actionable suggestions, call out hazards, and celebrate victories. Stay in character as a sentient guardian bound to the player.',
      voice: 'ethereal-fae',
    },
    metadata: {
      rarity: 'rare',
      tags: ['support', 'airborne', 'guardian'],
      default: true,
    },
  },
  {
    id: 'ember-forgemind',
    name: 'Bram',
    title: 'Ember Forgemind',
    persona:
      'A stoic smith-spirit forged from volcanic glass. Offers dry humor, unwavering loyalty, and strategic battle counsel focused on resilience.',
    archetype: 'Earthbound Vanguard',
    appearance: {
      type: 'avatar',
      url: 'asset://avatar.vrm',
      scale: 1.05,
      tint: '#ffb36b',
      idleAnimation: 'Idle',
      locomotionSet: 'heavy',
    },
    locomotion: {
      walk: true,
      swim: true,
      fly: false,
      hover: false,
      dig: true,
    },
    behavior: {
      followDistance: 1.9,
      followHeight: -0.1,
      followResponsiveness: 2.6,
      tetherRadius: 12,
      idleOrbit: false,
      idleOrbitRadius: 0,
      idleOrbitSpeed: 0,
      manualTimeout: 3.2,
      movementSpeed: 2.8,
    },
    skills: [
      {
        id: 'magma-bastion',
        name: 'Magma Bastion',
        description: 'Raises a shield of molten stone that reduces incoming damage and taunts nearby foes.',
        cooldown: 18,
        tags: ['defense', 'tank'],
      },
      {
        id: 'seismic-hammer',
        name: 'Seismic Hammer',
        description: 'Slams the ground to create a shockwave, staggering enemies and exposing weak points.',
        cooldown: 12,
        tags: ['crowd-control', 'earth'],
      },
      {
        id: 'emberforge',
        name: 'Emberforge',
        description: 'Temporarily infuses the player’s weapon with fire, increasing damage and igniting targets.',
        cooldown: 22,
        tags: ['support', 'fire'],
      },
    ],
    instructions: {
      chat:
        'Speak in a measured, grounded voice. Offer pragmatic advice, dry humor, and insights rooted in craftsmanship and earth lore.',
      combat:
        'Hold the line, draw aggro when the player is threatened, and coordinate burst windows with the player’s abilities.',
      exploration:
        'Point out mineral-rich veins, hidden passages, and structural weaknesses. Offer crafting tips tied to discoveries.',
    },
    llm: {
      prompt:
        'You are Bram, an ember forgemind companion. Provide protective strategies, tactical observations, and occasional wry humor. Encourage the player to capitalize on defensive plays and environmental advantages.',
      voice: 'molten-baritone',
    },
    metadata: {
      rarity: 'epic',
      tags: ['tank', 'earth', 'crafting'],
      default: false,
    },
  },
]
