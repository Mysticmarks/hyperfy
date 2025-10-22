import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import EventEmitter from 'eventemitter3'

let currentNow = 0

const histogram = {
  min: 0,
  max: 0,
  mean: 0,
  percentile: vi.fn(() => 0),
  enable: vi.fn(),
  disable: vi.fn(),
  reset: vi.fn(() => {
    histogram.min = 0
    histogram.max = 0
    histogram.mean = 0
  }),
}

const perfNowMock = vi.fn(() => currentNow)
const monitorEventLoopDelayMock = vi.fn(() => histogram)

vi.mock('node:perf_hooks', () => ({
  performance: {
    now: perfNowMock,
  },
  monitorEventLoopDelay: monitorEventLoopDelayMock,
  __setNow: value => {
    currentNow = value
  },
  __histogram: histogram,
}))

describe('ServerMonitor', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    currentNow = 0
    perfNowMock.mockImplementation(() => currentNow)
    perfNowMock.mockClear()
    monitorEventLoopDelayMock.mockClear()
    histogram.enable.mockClear()
    histogram.disable.mockClear()
    histogram.reset.mockClear()
    histogram.percentile.mockReset()
    histogram.percentile.mockReturnValue(0)
    histogram.min = 0
    histogram.max = 0
    histogram.mean = 0
    const perfHooks = await import('node:perf_hooks')
    perfHooks.__setNow(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('tracks tick performance and event loop delay statistics', async () => {
    const perfHooks = await import('node:perf_hooks')
    const { ServerMonitor } = await import('../../src/core/systems/ServerMonitor.js')

    const world = new EventEmitter()
    const monitor = new ServerMonitor(world)

    expect(monitorEventLoopDelayMock).toHaveBeenCalledTimes(1)

    monitor.start()
    expect(histogram.enable).toHaveBeenCalledTimes(1)

    perfHooks.__histogram.min = 2e6
    perfHooks.__histogram.max = 8e6
    perfHooks.__histogram.mean = 3e6
    perfHooks.__histogram.percentile.mockReturnValue(6e6)

    perfHooks.__setNow(0)
    world.emit('tick', { duration: 4, delta: 0.05 })
    perfHooks.__setNow(20)
    world.emit('tick', { duration: 6, delta: 0.04 })
    perfHooks.__setNow(40)
    world.emit('tick', { duration: 5, delta: 0.06 })

    const statsPromise = monitor.getStats()
    await vi.advanceTimersByTimeAsync(100)
    const stats = await statsPromise

    expect(stats.ticks.sampleCount).toBe(3)
    expect(stats.ticks.averageDurationMs).toBeCloseTo(5, 5)
    expect(stats.ticks.maxDurationMs).toBeCloseTo(6, 5)
    expect(stats.ticks.averageDeltaMs).toBeCloseTo(50, 5)
    expect(stats.ticks.observedRate).toBeCloseTo(20, 5)

    expect(stats.eventLoop).not.toBeNull()
    expect(stats.eventLoop?.minMs).toBeCloseTo(2, 5)
    expect(stats.eventLoop?.maxMs).toBeCloseTo(8, 5)
    expect(stats.eventLoop?.meanMs).toBeCloseTo(3, 5)
    expect(stats.eventLoop?.p99Ms).toBeCloseTo(6, 5)
    expect(histogram.reset).toHaveBeenCalledTimes(1)

    monitor.destroy()
    expect(histogram.disable).toHaveBeenCalledTimes(1)
  })
})
