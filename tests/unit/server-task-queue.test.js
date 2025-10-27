import { describe, expect, it } from 'vitest'

import { TaskPool } from '../../src/server/runtime/TaskPool.js'

const questDefinition = {
  id: 'test',
  steps: [
    { id: 'collect', type: 'collect', count: 2 },
    { id: 'defeat', type: 'defeat', count: 3 },
  ],
}

describe('TaskPool', () => {
  it('executes quest simulation tasks across workers', async () => {
    const pool = new TaskPool({ size: 2 })
    const events = [
      { stepId: 'collect', type: 'collect', amount: 1 },
      { stepId: 'collect', type: 'collect', amount: 1 },
      { stepId: 'defeat', type: 'defeat', amount: 2 },
      { stepId: 'defeat', type: 'defeat', amount: 1 },
    ]
    const [resultA, resultB] = await Promise.all([
      pool.run('quest:simulate-progress', { definition: questDefinition, events }),
      pool.run('metrics:aggregate-frames', {
        frames: [
          { durationMs: 3.2 },
          { durationMs: 4.8 },
        ],
      }),
    ])
    expect(resultA.progress.collect.count).toBe(2)
    expect(resultA.summary.status).toBe('ready-to-turn-in')
    expect(resultB.maxDuration).toBeCloseTo(4.8, 5)
    await pool.destroy()
  })

  it('falls back to inline execution when workers are unavailable', async () => {
    const pool = new TaskPool({ size: 1 })
    await pool.destroy()
    const inlinePool = new TaskPool({ inlineFallback: true })
    const result = await inlinePool.run('quest:simulate-progress', {
      definition: questDefinition,
      events: [{ stepId: 'collect', type: 'collect', amount: 5 }],
    })
    expect(result.progress.collect.count).toBe(2)
    await inlinePool.destroy()
  })
})
