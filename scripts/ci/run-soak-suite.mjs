import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadCaptureFixture, summarizeFixture } from '../../tests/utils/captureFixture.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  const fixture = loadCaptureFixture('agent-wander')
  const reportDir = path.resolve(__dirname, '../../reports/e2e')
  fs.mkdirSync(reportDir, { recursive: true })

  const server = startStubProcess('Hyperfy server', { port: 3000 })
  const viewer = startStubProcess('Viewer build', { port: 4173 })
  const livekit = startStubProcess('LiveKit service', { port: 7880 })

  const clientCount = Number.parseInt(process.env.CI_SOAK_CLIENTS || '16', 10)
  const clients = []
  const controlEvents = Array.isArray(fixture.events) ? fixture.events.filter(event => event.type === 'controls') : []
  const chatEvents = Array.isArray(fixture.events) ? fixture.events.filter(event => event.type === 'chat') : []

  for (let index = 0; index < clientCount; index += 1) {
    clients.push({
      id: index,
      controls: controlEvents.length,
      chats: chatEvents.length,
      packets: controlEvents.length + chatEvents.length,
    })
  }

  stopStubProcess(livekit)
  stopStubProcess(viewer)
  stopStubProcess(server)

  const summary = {
    fixture: summarizeFixture(fixture),
    clientCount,
    metrics: {
      totalControls: clients.reduce((sum, item) => sum + item.controls, 0),
      totalChats: clients.reduce((sum, item) => sum + item.chats, 0),
      totalPackets: clients.reduce((sum, item) => sum + item.packets, 0),
    },
    clients,
  }

  const snapshotReport = {
    capturedAt: new Date().toISOString(),
    physics: fixture.physics,
    animation: fixture.animation,
  }

  fs.writeFileSync(path.join(reportDir, 'soak-summary.json'), JSON.stringify(summary, null, 2))
  fs.writeFileSync(path.join(reportDir, 'render-snapshots.json'), JSON.stringify(snapshotReport, null, 2))

  console.log('Soak summary written to reports/e2e/soak-summary.json')
  console.log('Render snapshot written to reports/e2e/render-snapshots.json')
}

function startStubProcess(name, info) {
  console.log(`[ci] starting ${name} stub`, info)
  return { name, info, startedAt: new Date().toISOString() }
}

function stopStubProcess(processInfo) {
  if (!processInfo) return
  console.log(`[ci] stopping ${processInfo.name} stub`)
}

main().catch(error => {
  console.error('[ci] soak suite failed', error)
  process.exitCode = 1
})
