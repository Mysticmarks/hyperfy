import os from 'os'
import { monitorEventLoopDelay, performance as perfHooksPerformance } from 'node:perf_hooks'

import { System } from './System'

const SAMPLE_WINDOW_MS = 10_000

const getHighResTime = () => {
  if (perfHooksPerformance && typeof perfHooksPerformance.now === 'function') {
    return perfHooksPerformance.now()
  }
  if (typeof globalThis !== 'undefined' && globalThis.performance && typeof globalThis.performance.now === 'function') {
    return globalThis.performance.now()
  }
  return Date.now()
}

function toMilliseconds(value) {
  if (!Number.isFinite(value)) {
    return 0
  }
  return value / 1e6
}

export class ServerMonitor extends System {
  constructor(world) {
    super(world)
    this.sampleWindowMs = SAMPLE_WINDOW_MS
    this.samples = []
    this.totalDuration = 0
    this.totalDelta = 0
    this.maxDuration = 0
    this.eventLoopMonitor = typeof monitorEventLoopDelay === 'function' ? monitorEventLoopDelay({ resolution: 20 }) : null
    this.eventLoopMonitorEnabled = false
    this.handleTick = this.handleTick.bind(this)
  }

  start() {
    if (this.eventLoopMonitor && !this.eventLoopMonitorEnabled) {
      this.eventLoopMonitor.enable()
      this.eventLoopMonitorEnabled = true
    }

    if (typeof this.world?.on === 'function') {
      this.world.on('tick', this.handleTick)
    }
  }

  destroy() {
    if (this.eventLoopMonitor && this.eventLoopMonitorEnabled) {
      this.eventLoopMonitor.disable()
      this.eventLoopMonitorEnabled = false
    }

    if (typeof this.world?.off === 'function') {
      this.world.off('tick', this.handleTick)
    } else if (typeof this.world?.removeListener === 'function') {
      this.world.removeListener('tick', this.handleTick)
    }

    this.samples = []
    this.totalDuration = 0
    this.totalDelta = 0
    this.maxDuration = 0
  }

  handleTick(event) {
    const timestamp = getHighResTime()
    const duration = Number.isFinite(event?.duration) ? event.duration : 0
    const delta = Number.isFinite(event?.delta) ? event.delta : 0

    this.samples.push({ timestamp, duration, delta })
    this.totalDuration += duration
    this.totalDelta += delta
    if (duration > this.maxDuration) {
      this.maxDuration = duration
    }

    this.pruneSamples(timestamp)
  }

  pruneSamples(referenceTime) {
    const cutoff = referenceTime - this.sampleWindowMs
    let needsMaxRecalculation = false

    while (this.samples.length > 0 && this.samples[0].timestamp < cutoff) {
      const expired = this.samples.shift()
      this.totalDuration -= expired.duration
      this.totalDelta -= expired.delta
      if (expired.duration === this.maxDuration) {
        needsMaxRecalculation = true
      }
    }

    if (needsMaxRecalculation) {
      this.maxDuration = this.samples.reduce((max, sample) => Math.max(max, sample.duration), 0)
    }

    if (this.totalDuration < 0) this.totalDuration = 0
    if (this.totalDelta < 0) this.totalDelta = 0
  }

  async getStats() {
    const memoryUsage = process.memoryUsage()
    const startCpuUsage = process.cpuUsage()
    await new Promise(resolve => setTimeout(resolve, 100))
    const cpuUsage = process.cpuUsage(startCpuUsage)
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000 / 100

    const now = getHighResTime()
    this.pruneSamples(now)
    const sampleCount = this.samples.length
    const averageDurationMs = sampleCount ? this.totalDuration / sampleCount : 0
    const averageDeltaMs = sampleCount ? (this.totalDelta / sampleCount) * 1000 : 0
    const observedRate = averageDeltaMs > 0 ? 1000 / averageDeltaMs : 0
    const maxDurationMs = this.maxDuration

    let eventLoop = null
    if (this.eventLoopMonitor) {
      const min = toMilliseconds(this.eventLoopMonitor.min)
      const max = toMilliseconds(this.eventLoopMonitor.max)
      const mean = toMilliseconds(this.eventLoopMonitor.mean)
      const p99 = toMilliseconds(this.eventLoopMonitor.percentile?.(99) ?? 0)
      this.eventLoopMonitor.reset()
      eventLoop = {
        minMs: min,
        maxMs: max,
        meanMs: mean,
        p99Ms: p99,
      }
    }

    return {
      maxMemory: Math.round(os.totalmem() / 1024 / 1024),
      currentMemory: Math.round(memoryUsage.rss / 1024 / 1024),
      maxCPU: os.cpus().length * 100,
      currentCPU: cpuPercent,
      ticks: {
        sampleCount,
        windowMs: this.sampleWindowMs,
        averageDurationMs,
        maxDurationMs,
        averageDeltaMs,
        observedRate,
      },
      eventLoop,
    }
  }
}
