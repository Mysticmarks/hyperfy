import fs from 'node:fs'
import path from 'node:path'

export function loadCaptureFixture(nameOrObject) {
  if (!nameOrObject) {
    throw new Error('capture fixture name or object is required')
  }
  if (typeof nameOrObject === 'string') {
    const filePath = path.resolve('tests/fixtures/captures', `${nameOrObject}.json`)
    const raw = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(raw)
  }
  if (typeof nameOrObject === 'object') {
    return JSON.parse(JSON.stringify(nameOrObject))
  }
  throw new Error(`unsupported capture fixture type: ${typeof nameOrObject}`)
}

export function summarizeFixture(fixture) {
  return {
    name: fixture?.meta?.name ?? 'unknown',
    eventCount: Array.isArray(fixture?.events) ? fixture.events.length : 0,
    physicsFrames: Array.isArray(fixture?.physics) ? fixture.physics.length : 0,
    animationFrames: Array.isArray(fixture?.animation) ? fixture.animation.length : 0,
  }
}
