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
    const desiredSize = options.size ?? Math.max(1, Math.min(cpuCount - 1, 4))
    this.size = Math.max(1, desiredSize)
    this.inlineFallback = options.inlineFallback ?? false
    this.idle = []
    this.queue = []
    this.pending = new Map()
    this.workers = new Set()
    this.destroyed = false

    if (!this.inlineFallback) {
      for (let index = 0; index < this.size; index++) {
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
  }

  #spawnWorker() {
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
      this.#drain()
    } catch (error) {
      this.inlineFallback = true
      console.warn('[TaskPool] Falling back to inline execution:', error)
    }
  }

  #drain() {
    if (this.inlineFallback) return
    while (this.queue.length > 0 && this.idle.length > 0) {
      const job = this.queue.shift()
      const worker = this.idle.pop()
      if (!worker) break
      job.worker = worker
      this.pending.set(job.id, job)
      worker.postMessage({
        id: job.id,
        taskName: job.taskName,
        payload: job.payload,
      })
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
}
