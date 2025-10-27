import { parentPort } from 'node:worker_threads'
import { taskHandlers } from './task-handlers.js'

if (!parentPort) {
  throw new Error('Task worker must be executed as a worker thread')
}

parentPort.on('message', async message => {
  const { id, taskName, payload } = message ?? {}
  if (typeof id !== 'number') {
    parentPort.postMessage({
      id,
      error: {
        message: 'Task message missing numeric id',
        code: 'ERR_INVALID_MESSAGE',
      },
    })
    return
  }
  if (!taskHandlers.has(taskName)) {
    parentPort.postMessage({
      id,
      error: {
        message: `Unknown task "${taskName}"`,
        code: 'ERR_UNKNOWN_TASK',
      },
    })
    return
  }
  const handler = taskHandlers.get(taskName)
  try {
    const result = await handler(payload)
    parentPort.postMessage({ id, result })
  } catch (error) {
    parentPort.postMessage({
      id,
      error: {
        message: error?.message ?? 'Task execution failed',
        code: error?.code ?? 'ERR_TASK_FAILED',
        stack: error?.stack ?? null,
      },
    })
  }
})
