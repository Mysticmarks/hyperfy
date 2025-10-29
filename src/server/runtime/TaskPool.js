import os from 'node:os'
import { Worker } from 'node:worker_threads'

import { hasTaskHandler, taskHandlers } from './task-handlers.js'

let globalJobId = 0

function createWorker() {
  return new Worker(new URL('./task-worker.js', import.meta.url), {
    type: 'module',
  })
}

function formatWorkerError(error, taskName) {
  if (!error) {
    return new Error(`Worker exited unexpectedly while running task "${taskName}"`)
  }
  if (error instanceof Error) {
    return error
  }
  const err = new Error(error.message ?? `Worker failed while running task "${taskName}"`)
  if (error.stack) {
    err.stack = error.stack
  }
  err.code = error.code
  return err
}

export class TaskPool {
  constructor(options = {}) {
    const cpuCount = os.cpus()?.length ?? 1
    const defaultSize = Math.max(1, Math.min(cpuCount - 1, 4))
    const requestedSize = Math.max(1, options.size ?? defaultSize)
    const minSize = Math.max(1, options.minSize ?? requestedSize)
    const computedMax = options.maxSize ?? (options.size != null || options.minSize != null ? minSize : minSize)

    this.minSize = minSize
    this.maxSize = Math.max(this.minSize, computedMax)
    this.inlineFallback = options.inlineFallback ?? false
    this.scaleThreshold = Math.max(1, options.scaleThreshold ?? 2)
    this.idleTimeout = options.idleTimeout === 0 ? 0 : Math.max(0, options.idleTimeout ?? 30_000)
    this.autoScale = this.maxSize > this.minSize
    this.idle = []
    this.queue = []
    this.pending = new Map()
    this.workers = new Set()
    this.destroyed = false
    this.idleTimers = new Map()
    this.stats = {
      peakWorkers: 0,
    }

    if (!this.inlineFallback) {
      for (let index = 0; index < this.minSize; index++) {
        this.#spawnWorker()
      }
    }
  }

  async run(taskName, payload) {
    if (this.destroyed) {
      throw new Error('TaskPool has been destroyed')
    }
    if (!hasTaskHandler(taskName)) {
      throw new Error(`Unknown task "${taskName}"`)
    }
    if (this.inlineFallback || this.workers.size === 0) {
      return taskHandlers.get(taskName)(payload)
    }
    const jobId = globalJobId++
    return new Promise((resolve, reject) => {
      const job = { id: jobId, taskName, payload, resolve, reject, worker: null }
      this.queue.push(job)
      this.#drain()
    })
  }

  async destroy() {
    this.destroyed = true
    for (const worker of this.workers) {
      this.#clearIdleTimer(worker)
      worker.removeAllListeners()
      await worker.terminate()
    }
    this.workers.clear()
    this.idle.length = 0
    for (const [, job] of this.pending) {
      job.reject(new Error('Task cancelled due to pool destruction'))
    }
    this.pending.clear()
    this.queue.length = 0
    for (const timer of this.idleTimers.values()) {
      clearTimeout(timer)
    }
    this.idleTimers.clear()
  }

  #spawnWorker() {
    if (this.workers.size >= this.maxSize) {
      return
    }
    try {
      const worker = createWorker()
      worker.on('message', message => {
        this.#handleMessage(worker, message)
      })
      worker.on('error', error => {
        this.#handleWorkerFailure(worker, error)
      })
      worker.on('exit', code => {
        if (!this.destroyed && code !== 0) {
          this.#handleWorkerFailure(worker, new Error(`Worker exited with code ${code}`))
        }
      })
      this.workers.add(worker)
      this.idle.push(worker)
      this.stats.peakWorkers = Math.max(this.stats.peakWorkers, this.workers.size)
      this.#drain()
    } catch (error) {
      this.inlineFallback = true
      console.warn('[TaskPool] Falling back to inline execution:', error)
    }
  }

  #drain() {
    if (this.inlineFallback) return
    this.#maybeScale()
    while (this.queue.length > 0 && this.idle.length > 0) {
      const job = this.queue.shift()
      const worker = this.idle.pop()
      if (!worker) break
      job.worker = worker
      this.pending.set(job.id, job)
      this.#clearIdleTimer(worker)
      worker.postMessage({
        id: job.id,
        taskName: job.taskName,
        payload: job.payload,
      })
    }
    if (this.queue.length > 0) {
      this.#maybeScale()
    }
  }

  #handleMessage(worker, message) {
    if (!message || typeof message.id !== 'number') {
      return
    }
    const job = this.pending.get(message.id)
    if (!job) {
      return
    }
    this.pending.delete(message.id)
    if (!this.destroyed) {
      this.idle.push(worker)
      this.#scheduleIdleReclaim(worker)
    }
    if (message.error) {
      job.reject(formatWorkerError(message.error, job.taskName))
    } else {
      job.resolve(message.result)
    }
    this.#drain()
  }

  #handleWorkerFailure(worker, error) {
    if (this.destroyed) return
    this.#clearIdleTimer(worker)
    for (const [id, job] of this.pending.entries()) {
      if (job.worker === worker) {
        this.pending.delete(id)
        this.queue.unshift(job)
      }
    }
    this.workers.delete(worker)
    const index = this.idle.indexOf(worker)
    if (index >= 0) {
      this.idle.splice(index, 1)
    }
    if (this.workers.size === 0) {
      this.inlineFallback = true
    } else if (!this.inlineFallback) {
      this.#spawnWorker()
    }
    if (error) {
      console.warn('[TaskPool] Worker failure:', error)
    }
    this.#drain()
  }

  #maybeScale() {
    if (!this.autoScale || this.inlineFallback) {
      return
    }
    if (this.workers.size >= this.maxSize) {
      return
    }
    if (this.queue.length === 0) {
      return
    }
    if (this.idle.length > 0) {
      return
    }
    const busyWorkers = Math.max(1, this.workers.size - this.idle.length)
    const saturation = this.queue.length / busyWorkers
    if (saturation >= this.scaleThreshold) {
      this.#spawnWorker()
    }
  }

  #scheduleIdleReclaim(worker) {
    if (!this.autoScale || this.idleTimeout <= 0) {
      return
    }
    if (this.destroyed) {
      return
    }
    if (this.workers.size <= this.minSize) {
      return
    }
    if (this.idleTimers.has(worker)) {
      return
    }
    const timer = setTimeout(() => {
      this.idleTimers.delete(worker)
      void this.#retireWorker(worker)
    }, this.idleTimeout)
    if (typeof timer.unref === 'function') {
      timer.unref()
    }
    this.idleTimers.set(worker, timer)
  }

  #clearIdleTimer(worker) {
    const timer = this.idleTimers.get(worker)
    if (timer) {
      clearTimeout(timer)
      this.idleTimers.delete(worker)
    }
  }

  async #retireWorker(worker) {
    if (this.destroyed) {
      return
    }
    if (this.workers.size <= this.minSize) {
      return
    }
    if (!this.workers.has(worker)) {
      return
    }
    this.workers.delete(worker)
    const index = this.idle.indexOf(worker)
    if (index >= 0) {
      this.idle.splice(index, 1)
    }
    worker.removeAllListeners()
    try {
      await worker.terminate()
    } catch (error) {
      console.warn('[TaskPool] Failed to retire worker:', error)
    }
    if (this.workers.size === 0) {
      this.inlineFallback = true
    }
  }

  metrics() {
    return {
      workers: this.workers.size,
      idleWorkers: this.idle.length,
      pendingJobs: this.queue.length,
      inFlightJobs: this.pending.size,
      peakWorkers: this.stats.peakWorkers,
      inlineFallback: this.inlineFallback,
    }
  }
}
