import { System } from './System'
import { TaskPool } from '../../server/runtime/TaskPool.js'

export class ServerTaskQueue extends System {
  constructor(world) {
    super(world)
    this.pool = null
    this.metrics = {
      tasksExecuted: 0,
      tasksFailed: 0,
      lastFailure: null,
    }
  }

  async init(options = {}) {
    const inlineFallback = options.forceInline === true
    this.pool = new TaskPool({ inlineFallback })
  }

  async destroy() {
    await this.pool?.destroy()
    this.pool = null
  }

  async run(taskName, payload) {
    if (!this.pool) {
      throw new Error('ServerTaskQueue has not been initialised')
    }
    try {
      const result = await this.pool.run(taskName, payload)
      this.metrics.tasksExecuted++
      return result
    } catch (error) {
      this.metrics.tasksFailed++
      this.metrics.lastFailure = {
        at: Date.now(),
        taskName,
        message: error?.message ?? 'Unknown error',
      }
      throw error
    }
  }
}
