import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('Server system boot smoke test', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('invokes world ticks on the configured cadence', async () => {
    const { Server } = await import('../../src/core/systems/Server.js')
    const tick = vi.fn()
    const world = { tick }
    const server = new Server(world)

    const nowSpy = vi.spyOn(performance, 'now').mockReturnValue(0)

    server.start()

    expect(tick).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(server.tickInterval * 1000)
    expect(tick).toHaveBeenCalledTimes(2)

    server.destroy()
    nowSpy.mockRestore()
  })
})
