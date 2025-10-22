import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const writePacketMock = vi.fn(() => Symbol('packet'))

vi.mock('moment', () => ({
  default: () => ({ toISOString: () => '2024-10-22T00:00:00.000Z' }),
}))

vi.mock('../../src/core/packets.js', () => ({
  writePacket: writePacketMock,
}))

vi.mock('../../src/core/Socket.js', () => ({
  Socket: class {},
}))

vi.mock('../../src/core/utils.js', () => ({
  uuid: () => 'uuid-mock',
}))

vi.mock('../../src/core/utils-server.js', () => ({
  createJWT: vi.fn(),
  readJWT: vi.fn(),
}))

vi.mock('lodash-es', () => ({
  cloneDeep: value => JSON.parse(JSON.stringify(value)),
  isNumber: value => typeof value === 'number',
}))

vi.mock('../../src/core/extras/ranks.js', () => ({
  Ranks: {},
  hasRank: () => false,
}))

const getServerConfigMock = vi.fn(() => ({
  server: {
    network: {
      replication: {
        throttleSeconds: 0.1,
        perTickBudget: 4,
      },
      interestRadius: 120,
    },
    saveInterval: null,
  },
  public: {},
  auth: {},
}))

vi.mock('../../src/server/config.js', () => ({
  getServerConfig: getServerConfigMock,
}))

describe('ServerNetwork replication throttling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('delays replicated payloads until throttle interval has elapsed', async () => {
    const { ServerNetwork } = await import('../../src/core/systems/ServerNetwork.js')

    const world = {
      emit: vi.fn(),
      events: { emit: vi.fn() },
      entities: {
        get: vi.fn(() => ({
          isPlayer: true,
          data: { position: [0, 0, 0] },
        })),
      },
      blueprints: { add: vi.fn(), get: vi.fn() },
      settings: { deserialize: vi.fn(), setHasAdminCode: vi.fn(), on: vi.fn() },
    }

    const network = new ServerNetwork(world)
    network.replicationThrottle = 0.1
    network.replicationBudget = 4

    const socket = {
      id: 'socket-1',
      send: vi.fn(),
      sendPacket: vi.fn(),
      alive: true,
      ping: vi.fn(),
      disconnect: vi.fn(),
      player: { data: { position: [0, 0, 0] } },
    }

    network.sockets.set(socket.id, socket)

    let currentTime = 0
    network.getTime = () => currentTime

    const payload = { id: 'player-1', position: [1, 0, 0] }
    network.send('entityModified', payload)

    expect(network.replicationQueues.get(socket.id)?.size ?? 0).toBe(1)

    currentTime = 1
    network.flushReplication()

    expect(socket.send).toHaveBeenCalledTimes(1)
    expect(socket.send).toHaveBeenLastCalledWith('entityModified', payload)
    expect(network.replicationQueues.size).toBe(0)

    const updatedPayload = { id: 'player-1', position: [2, 0, 0] }
    network.send('entityModified', updatedPayload)

    currentTime = 1.05
    network.flushReplication()

    expect(socket.send).toHaveBeenCalledTimes(1)
    expect(network.replicationQueues.get(socket.id)?.size ?? 0).toBe(1)

    currentTime = 1.2
    network.flushReplication()

    expect(socket.send).toHaveBeenCalledTimes(2)
    expect(socket.send).toHaveBeenLastCalledWith('entityModified', expect.objectContaining(updatedPayload))
    expect(network.replicationQueues.size).toBe(0)

    clearInterval(network.socketIntervalId)
  })
})
