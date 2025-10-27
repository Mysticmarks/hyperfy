import { System } from './System'
import { taskHandlers } from '../../server/runtime/task-handlers.js'

const builtinQuestDefinitions = [
  Object.freeze({
    id: 'welcome-to-hyperfy',
    title: 'Welcome to Hyperfy',
    description: 'Orient new players and ensure they learn core traversal mechanics.',
    category: 'onboarding',
    steps: [
      { id: 'speak-to-guide', type: 'talk', count: 1, description: 'Speak to the onboarding guide in the plaza.' },
      { id: 'visit-builder', type: 'visit', count: 1, description: 'Walk to the creator terminal to unlock build mode.' },
      { id: 'collect-resource', type: 'collect', count: 3, description: 'Gather three ether seeds scattered around spawn.' },
    ],
    rewards: {
      experience: 250,
      currency: 100,
      unlocks: ['builder-mode'],
    },
  }),
  Object.freeze({
    id: 'first-encounter',
    title: 'First Encounter',
    description: 'Teach basic combat awareness with a safe holosim encounter.',
    category: 'combat',
    steps: [
      { id: 'equip-weapon', type: 'interact', count: 1, description: 'Equip the default resonator from your inventory.' },
      { id: 'defeat-holos', type: 'defeat', count: 5, description: 'Defeat five holoforms spawned by the arena console.' },
    ],
    rewards: {
      experience: 400,
      items: [{ itemId: 'resonator-mk2', quantity: 1 }],
    },
  }),
]

function clone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

export class ServerQuests extends System {
  constructor(world) {
    super(world)
    this.definitions = new Map()
  }

  async init(options = {}) {
    const customDefinitions = Array.isArray(options.questDefinitions) ? options.questDefinitions : []
    this.reloadDefinitions([...builtinQuestDefinitions, ...customDefinitions])
  }

  reloadDefinitions(definitions = []) {
    this.definitions.clear()
    for (const definition of definitions) {
      if (!definition?.id) continue
      const entry = {
        ...definition,
        steps: Array.isArray(definition.steps) ? definition.steps.map(step => ({ ...step })) : [],
      }
      this.definitions.set(entry.id, Object.freeze(entry))
    }
  }

  getDefinition(questId) {
    return this.definitions.get(questId) ?? null
  }

  listDefinitions() {
    return Array.from(this.definitions.values())
  }

  async enrichQuestState(state = {}, options = {}) {
    const questId = state.questId ?? options.questId
    if (!questId) return { state, summary: null }
    const definition = this.getDefinition(questId)
    if (!definition) {
      return { state, summary: null }
    }
    const progress = clone(state.progress ?? {})
    const payload = {
      definition,
      progress,
      events: options.events ?? [],
    }
    const executor = this.world?.tasks
    let result
    if (executor?.run) {
      result = await executor.run('quest:simulate-progress', payload)
    } else {
      const handler = taskHandlers.get('quest:simulate-progress')
      result = await handler(payload)
    }
    const nextState = {
      ...state,
      questId,
      status: result.summary?.status ?? state.status ?? 'active',
      progress: result.progress,
    }
    return { state: nextState, summary: result.summary }
  }
}
