import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadCaptureFixture } from '../utils/captureFixture'
import { createAgentWorldAdapter } from '../utils/nodeWorldAdapter'

let createdWorld
let createdWorlds = []
let randomQueue = []
let randomSpy
let fixtureForTest = loadCaptureFixture('agent-wander')

function setRandomSequence(sequence) {
  randomQueue = Array.isArray(sequence) ? sequence.slice() : []
}

const createNodeClientWorldMock = vi.fn(() => {
  createdWorld = createAgentWorldAdapter({ fixture: fixtureForTest })
  createdWorlds.push(createdWorld)
  return createdWorld
})

vi.mock('../../build/world-node-client.js', () => ({
  createNodeClientWorld: createNodeClientWorldMock,
}))

describe('agent integration scenarios', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
    process.env.HYPERFY_AGENT_WS_URL = 'ws://localhost:3000/ws'
    process.env.HYPERFY_AGENT_NAME = 'TestAgent'
    process.env.HYPERFY_AGENT_CHAT_MESSAGE = 'integration hello'
    process.env.HYPERFY_AGENT_CHAT_DELAY_MS = '10'
    process.env.HYPERFY_AGENT_CHAT_ENABLED = 'true'
    process.env.HYPERFY_AGENT_MOVE_ENABLED = 'true'
    process.env.HYPERFY_AGENT_MOVE_MODE = 'wander'
    process.env.HYPERFY_AGENT_WANDER_KEYS = 'keyW,keyD'
    process.env.HYPERFY_AGENT_WANDER_INTERVAL_MS = '15'
    process.env.HYPERFY_AGENT_WANDER_PRESS_PROBABILITY = '1'
    process.env.HYPERFY_AGENT_AUTO_RECONNECT = 'false'
    process.env.HYPERFY_AGENT_VERBOSE = 'false'
    vi.spyOn(process, 'exit').mockImplementation(() => {})
    createdWorld = undefined
    createdWorlds = []
    createNodeClientWorldMock.mockClear()
    fixtureForTest = loadCaptureFixture('agent-wander')
    randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
      if (randomQueue.length === 0) return 0.5
      return randomQueue.shift()
    })
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    randomSpy?.mockRestore()
    vi.restoreAllMocks()
    createdWorld = undefined
    createdWorlds = []
    randomQueue = []
    delete process.env.HYPERFY_AGENT_WS_URL
    delete process.env.HYPERFY_AGENT_NAME
    delete process.env.HYPERFY_AGENT_CHAT_MESSAGE
    delete process.env.HYPERFY_AGENT_CHAT_DELAY_MS
    delete process.env.HYPERFY_AGENT_CHAT_ENABLED
    delete process.env.HYPERFY_AGENT_MOVE_ENABLED
    delete process.env.HYPERFY_AGENT_MOVE_MODE
    delete process.env.HYPERFY_AGENT_WANDER_KEYS
    delete process.env.HYPERFY_AGENT_WANDER_INTERVAL_MS
    delete process.env.HYPERFY_AGENT_WANDER_PRESS_PROBABILITY
    delete process.env.HYPERFY_AGENT_AUTO_RECONNECT
    delete process.env.HYPERFY_AGENT_RECONNECT_DELAY_MS
    delete process.env.HYPERFY_AGENT_VERBOSE
    process.removeAllListeners('SIGINT')
    process.removeAllListeners('SIGTERM')
    vi.resetModules()
  })

  it('replays captured controls and chat with deterministic latency', async () => {
    const baseFixture = loadCaptureFixture('agent-wander')
    fixtureForTest = {
      ...baseFixture,
      meta: {
        ...baseFixture.meta,
        autoplayEvents: true,
      },
    }

    process.env.HYPERFY_AGENT_MOVE_ENABLED = 'false'
    process.env.HYPERFY_AGENT_CHAT_DELAY_MS = '450'

    await import('../../agent.mjs')

    expect(createNodeClientWorldMock).toHaveBeenCalledTimes(1)
    const world = createdWorlds[0]
    expect(world).toBeDefined()

    await vi.advanceTimersByTimeAsync(1000)
    await world.waitForReady()
    await world.untilIdle()

    expect(world.telemetry.controls).toEqual([
      { key: 'keyW', state: 'press' },
      { key: 'keyW', state: 'release' },
      { key: 'keyD', state: 'press' },
      { key: 'keyD', state: 'release' },
    ])
    expect(world.telemetry.chat.some(entry => entry.message === 'integration hello')).toBe(true)
    expect(world.getPhysicsFrame(1)).toEqual(fixtureForTest.physics[1])
    expect(world.getAnimationFrame(1)).toEqual(fixtureForTest.animation[1])
    expect(world.telemetry.networkPackets.find(packet => packet.name === 'chatAdded')).toBeTruthy()
  })

  it('auto reconnects after a disconnect when enabled', async () => {
    process.env.HYPERFY_AGENT_CHAT_ENABLED = 'false'
    process.env.HYPERFY_AGENT_MOVE_ENABLED = 'false'
    process.env.HYPERFY_AGENT_AUTO_RECONNECT = 'true'
    process.env.HYPERFY_AGENT_RECONNECT_DELAY_MS = '1200'

    await import('../../agent.mjs')

    expect(createNodeClientWorldMock).toHaveBeenCalledTimes(1)
    const firstWorld = createdWorlds[0]
    expect(firstWorld).toBeDefined()

    await vi.advanceTimersByTimeAsync(100)
    await firstWorld.waitForReady()

    firstWorld.emit('disconnect', { reason: 'network lost' })

    await vi.advanceTimersByTimeAsync(1199)
    expect(createNodeClientWorldMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(2)
    expect(createNodeClientWorldMock).toHaveBeenCalledTimes(2)

    const secondWorld = createdWorlds[1]
    expect(secondWorld).toBeDefined()
    expect(secondWorld).not.toBe(firstWorld)
    expect(firstWorld.telemetry.destroys).toBeGreaterThanOrEqual(1)
    expect(firstWorld.telemetry.resets).toBeGreaterThanOrEqual(1)

    await vi.advanceTimersByTimeAsync(100)
    await secondWorld.waitForReady()

    expect(secondWorld.telemetry.controls.length).toBe(0)
  })
})
