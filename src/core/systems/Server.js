import { System } from './System'

const DEFAULT_TICKS_PER_SECOND = 30

/**
 * Server System
 *
 * - Runs on the server
 * - Ticks!
 *
 */
export class Server extends System {
  constructor(world) {
    super(world)
    this.timerId = null
    this.tickInterval = 1 / DEFAULT_TICKS_PER_SECOND
  }

  start() {
    this.updateTickInterval()
    this.tick()
  }

  tick = () => {
    const time = performance.now()
    this.world.tick(time)
    this.updateTickInterval()
    this.timerId = setTimeout(this.tick, this.tickInterval * 1000)
  }

  destroy() {
    clearTimeout(this.timerId)
  }

  updateTickInterval() {
    const ticksPerSecond = this.resolveTickRate()
    const interval = 1 / ticksPerSecond
    if (interval !== this.tickInterval) {
      this.tickInterval = interval
    }
  }

  resolveTickRate() {
    const configured = this.world?.serverTickRate
    if (typeof configured === 'number' && Number.isFinite(configured) && configured > 0) {
      return configured
    }
    return DEFAULT_TICKS_PER_SECOND
  }
}
