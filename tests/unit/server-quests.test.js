import { describe, expect, it, vi } from 'vitest'

import { ServerQuests } from '../../src/core/systems/ServerQuests.js'

function createWorld(overrides = {}) {
  return {
    tasks: overrides.tasks,
  }
}

describe('ServerQuests', () => {
  it('delegates progress simulation to the task queue when available', async () => {
    const run = vi.fn().mockResolvedValue({
      progress: {
        'speak-to-guide': { count: 1, completed: true },
      },
      summary: { status: 'ready-to-turn-in' },
    })
    const quests = new ServerQuests(createWorld({ tasks: { run } }))
    await quests.init()
    const { state, summary } = await quests.enrichQuestState({ questId: 'welcome-to-hyperfy' }, {
      events: [{ stepId: 'speak-to-guide', type: 'talk' }],
    })
    expect(run).toHaveBeenCalledWith('quest:simulate-progress', expect.objectContaining({
      definition: expect.objectContaining({ id: 'welcome-to-hyperfy' }),
    }))
    expect(summary.status).toBe('ready-to-turn-in')
    expect(state.progress['speak-to-guide'].completed).toBe(true)
  })

  it('falls back to inline handlers when no task queue is registered', async () => {
    const quests = new ServerQuests(createWorld())
    await quests.init()
    const { state, summary } = await quests.enrichQuestState({ questId: 'welcome-to-hyperfy' }, {
      events: [
        { stepId: 'speak-to-guide', type: 'talk', amount: 1 },
        { stepId: 'visit-builder', type: 'visit', amount: 1 },
        { stepId: 'collect-resource', type: 'collect', amount: 3 },
      ],
    })
    expect(summary.status).toBe('ready-to-turn-in')
    expect(state.progress['collect-resource'].count).toBe(3)
  })
})
