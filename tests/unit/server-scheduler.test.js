import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

describe('Server scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('limits catch-up ticks when the loop falls behind', async () => {
    const { Server } = await import('../../src/core/systems/Server.js')
    const tick = vi.fn()
    let now = 0
    const server = new Server({ tick }, { timeProvider: () => now, maxCatchUpTicks: 2 })

    server.start()

    expect(tick).toHaveBeenCalledTimes(1)

    const intervalMs = server.tickInterval * 1000

    now += intervalMs * 10
    vi.advanceTimersToNextTimer()

    expect(tick).toHaveBeenCalledTimes(1 + 2)

    now += intervalMs
    vi.advanceTimersToNextTimer()

    expect(tick).toHaveBeenCalledTimes(1 + 2 + 1)

    server.destroy()
  })

  it('prefers world-configured catch-up limits over constructor options', async () => {
    const { Server } = await import('../../src/core/systems/Server.js')
    const tick = vi.fn()
    let now = 0
    const world = { tick, serverMaxCatchUpTicks: 1 }
    const server = new Server(world, { timeProvider: () => now, maxCatchUpTicks: 4 })

    server.start()

    expect(tick).toHaveBeenCalledTimes(1)

    const intervalMs = server.tickInterval * 1000
    now += intervalMs * 10
    vi.advanceTimersToNextTimer()

    expect(tick).toHaveBeenCalledTimes(1 + 1)

    server.destroy()

    now += intervalMs * 5
    vi.advanceTimersByTime(intervalMs * 5)

    expect(tick).toHaveBeenCalledTimes(1 + 1)
  })

  it('re-schedules ticks when the world changes the configured rate', async () => {
    const { Server } = await import('../../src/core/systems/Server.js')
    let now = 0
    const world = {
      serverTickRate: 30,
      tick: vi.fn(time => {
        if (time === 0) {
          world.serverTickRate = 60
        }
      }),
    }

    const server = new Server(world, { timeProvider: () => now })

    expect(server.tickInterval).toBeCloseTo(1 / 30, 5)

    server.start()

    const nextIntervalMs = server.tickInterval * 1000
    expect(server.tickInterval).toBeCloseTo(1 / 60, 5)

    now += nextIntervalMs
    vi.advanceTimersToNextTimer()

    expect(server.tickInterval).toBeCloseTo(1 / 60, 5)
    expect(world.tick).toHaveBeenCalledTimes(2)
    const secondTickTime = world.tick.mock.calls[1][0]
    expect(secondTickTime).toBeCloseTo(nextIntervalMs, 5)

    server.destroy()
  })
})
