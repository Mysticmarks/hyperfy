import { System } from './System'

const DEFAULT_TICKS_PER_SECOND = 30
const DEFAULT_MAX_CATCH_UP_TICKS = 5

/**
 * Server System
 *
 * - Runs on the server
 * - Ticks!
 *
 */
export class Server extends System {
  constructor(world, options = {}) {
    super(world)
    this.timerId = null
    this.running = false
    this.tickInterval = 1 / DEFAULT_TICKS_PER_SECOND
    this.tickIntervalMs = this.tickInterval * 1000
    this.lastTickAt = 0
    this.nextTickAt = 0
    this.maxCatchUpTicks = Number.isInteger(options.maxCatchUpTicks) && options.maxCatchUpTicks >= 0
      ? options.maxCatchUpTicks
      : DEFAULT_MAX_CATCH_UP_TICKS
    this.timeProvider = typeof options.timeProvider === 'function' ? options.timeProvider : () => performance.now()
  }

  start() {
    if (this.running) return
    this.running = true
    this.updateTickInterval()
    const now = this.getTime()
    this.lastTickAt = now - this.tickIntervalMs
    this.nextTickAt = now
    this.tick()
  }

  getTime() {
    return this.timeProvider()
  }

  tick = () => {
    if (!this.running) {
      return
    }

    this.updateTickInterval()

    const now = this.getTime()
    const maxCatchUpTicks = this.resolveMaxCatchUpTicks()

    let executed = 0
    let nextTarget = Number.isFinite(this.nextTickAt) && this.nextTickAt > 0 ? this.nextTickAt : now

    while (now >= nextTarget && executed < maxCatchUpTicks) {
      this.runTick(nextTarget)
      executed += 1
      nextTarget = this.lastTickAt + this.tickIntervalMs
    }

    if (executed === 0) {
      const scheduledTime = Math.max(now, this.lastTickAt + this.tickIntervalMs)
      this.runTick(scheduledTime)
      nextTarget = this.lastTickAt + this.tickIntervalMs
    } else if (executed >= maxCatchUpTicks && now >= nextTarget) {
      nextTarget = now + this.tickIntervalMs
      this.lastTickAt = now
    }

    this.nextTickAt = nextTarget

    const delay = Math.max(0, this.nextTickAt - this.getTime())
    this.timerId = setTimeout(this.tick, delay)
  }

  runTick(time) {
    this.world.tick(time)
    this.lastTickAt = time
    this.updateTickInterval()
  }

  destroy() {
    this.running = false
    if (this.timerId) {
      clearTimeout(this.timerId)
      this.timerId = null
    }
  }

  updateTickInterval() {
    const ticksPerSecond = this.resolveTickRate()
    const intervalSeconds = 1 / ticksPerSecond
    if (Number.isFinite(intervalSeconds) && intervalSeconds > 0) {
      this.tickInterval = intervalSeconds
      this.tickIntervalMs = intervalSeconds * 1000
    }
  }

  resolveTickRate() {
    const configured = this.world?.serverTickRate
    if (typeof configured === 'number' && Number.isFinite(configured) && configured > 0) {
      return configured
    }
    return DEFAULT_TICKS_PER_SECOND
  }

  resolveMaxCatchUpTicks() {
    const configured = this.world?.serverMaxCatchUpTicks
    if (Number.isInteger(configured) && configured >= 0) {
      return configured
    }
    return this.maxCatchUpTicks
  }
}
