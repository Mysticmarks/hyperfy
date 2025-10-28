import 'ses'
import '../core/lockdown'
import './bootstrap'

import { createServerApp } from './runtime/createServerApp.js'

const runtime = await createServerApp()
const {
  fastify,
  config: {
    server: { port },
  },
} = runtime

try {
  await fastify.listen({ port, host: '0.0.0.0' })
} catch (err) {
  console.error(err)
  console.error(`failed to launch on port ${port}`)
  await runtime.close()
  process.exit(1)
}

console.info(`running on port ${port}`)

process.on('SIGINT', async () => {
  await runtime.close()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await runtime.close()
  process.exit(0)
})
