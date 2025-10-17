import { World } from './World'

import { Client } from './systems/Client'
import { ClientPrefs } from './systems/ClientPrefs'
import { BrowserLoader } from './systems/BrowserLoader'
import { ClientControls } from './systems/ClientControls'
import { ClientGraphics } from './systems/ClientGraphics'
import { ClientEnvironment } from './systems/ClientEnvironment'
// import { ClientAudio } from './systems/ClientAudio'

export { System } from './systems/System'

export function createViewerWorld() {
  const world = new World()
  world.register('client', Client)
  world.register('prefs', ClientPrefs)
  world.register('loader', BrowserLoader)
  world.register('controls', ClientControls)
  world.register('graphics', ClientGraphics)
  world.register('environment', ClientEnvironment)
  // world.register('audio', ClientAudio)
  return world
}
