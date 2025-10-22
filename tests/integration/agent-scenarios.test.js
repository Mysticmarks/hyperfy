import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'node:events'

class StubWorld extends EventEmitter {
  constructor() {
    super()
    this.initCalls = []
    this.controls = {
      simulateButton: vi.fn(),
      reset: vi.fn(),
    }
    this.chat = {
      send: vi.fn(),
    }
    this.destroy = vi.fn()
    this.livekit = {
      connect: vi.fn(async () => {
        this.livekitConnected = true
      }),
    }
    this.livekitConnected = false
  }

  init(options) {
    this.initCalls.push(options)
    setTimeout(() => {
      this.livekitConnected = true
      this.emit('livekit-connected', { room: 'stub-room' })
      this.emit('ready')
    }, 0)
  }
}

let createdWorld

const createNodeClientWorldMock = vi.fn(() => {
  createdWorld = new StubWorld()
  return createdWorld
})

vi.mock('../../build/world-node-client.js', () => ({
  createNodeClientWorld: createNodeClientWorldMock,
}))

describe('agent integration scenarios', () => {
  beforeEach(() => {
    vi.useFakeTimers()
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
  })

  afterEach(() => {
    vi.runAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    createdWorld = undefined
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
    delete process.env.HYPERFY_AGENT_VERBOSE
    process.removeAllListeners('SIGINT')
    process.removeAllListeners('SIGTERM')
  })

  it('drives movement, chat, and livekit hooks headlessly', async () => {
    await import('../../agent.mjs')

    expect(createNodeClientWorldMock).toHaveBeenCalledTimes(1)
    expect(createdWorld).toBeDefined()

    vi.advanceTimersByTime(20)

    expect(createdWorld?.initCalls[0]).toMatchObject({
      wsUrl: 'ws://localhost:3000/ws',
      name: 'TestAgent',
    })

    expect(createdWorld?.livekitConnected).toBe(true)
    expect(createdWorld?.chat.send).toHaveBeenCalledWith('integration hello')
    expect(createdWorld?.controls.simulateButton).toHaveBeenCalled()

    createdWorld?.emit('disconnect')
    vi.advanceTimersByTime(50)

    expect(createdWorld?.controls.reset).toHaveBeenCalled()
  })
})
