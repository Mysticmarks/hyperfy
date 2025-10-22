import { createVRMAvatarContext } from '../avatar/createVRMAvatar.js'

export function createVRMFactory(glb, setupMaterial) {
  const context = createVRMAvatarContext(glb, { setupMaterial })

  return {
    create(matrix, hooks, node) {
      return context.createInstance({ matrix, hooks, node })
    },
    applyStats(stats) {
      context.applyStats(stats)
    },
  }
}
