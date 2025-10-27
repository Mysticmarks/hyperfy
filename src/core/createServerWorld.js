import { World } from './World'

import { Server } from './systems/Server'
import { ServerLiveKit } from './systems/ServerLiveKit'
import { ServerNetwork } from './systems/ServerNetwork'
import { ServerCharacters } from './systems/ServerCharacters'
import { NodeLoader } from './systems/NodeLoader'
import { ServerEnvironment } from './systems/ServerEnvironment'
import { ServerMonitor } from './systems/ServerMonitor'
import { ServerTaskQueue } from './systems/ServerTaskQueue'
import { ServerQuests } from './systems/ServerQuests'

export function createServerWorld() {
  const world = new World()
  world.register('tasks', ServerTaskQueue)
  world.register('server', Server)
  world.register('livekit', ServerLiveKit)
  world.register('network', ServerNetwork)
  world.register('loader', NodeLoader)
  world.register('environment', ServerEnvironment)
  world.register('monitor', ServerMonitor)
  world.register('characters', ServerCharacters)
  world.register('quests', ServerQuests)
  return world
}
