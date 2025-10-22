import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MockNode } from '../utils/mockNode.js'

const parseAsyncMock = vi.fn(async () => ({ scene: {}, userData: {} }))
const createVRMFactoryMock = vi.fn(() => ({
  create: vi.fn(() => ({
    setEmote: vi.fn(),
    setVisible: vi.fn(),
    disableRateCheck: vi.fn(),
    destroy: vi.fn(),
    updateRate: vi.fn(),
    getHeadToHeight: () => 1.7,
    move: vi.fn(),
  })),
  applyStats: vi.fn(),
}))

vi.mock('three/examples/jsm/loaders/RGBELoader.js', () => ({
  RGBELoader: class {},
}))

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    constructor() {
      this.register = vi.fn()
    }

    async parseAsync(buffer) {
      return parseAsyncMock(buffer)
    }
  },
}))

vi.mock('@pixiv/three-vrm', () => ({
  VRMLoaderPlugin: class {},
}))

vi.mock('../../src/core/extras/createVRMFactory.js', () => ({
  createVRMFactory: createVRMFactoryMock,
}))

vi.mock('../../src/core/extras/createNode.js', () => ({
  createNode: (type, options) => new MockNode(type, options),
}))

function createWorldStub() {
  return {
    setupMaterial: vi.fn(),
    resolveURL: url => url,
    camera: { matrixWorld: {} },
    stage: {
      scene: {},
      octree: {
        insert: vi.fn(),
        move: vi.fn(),
        remove: vi.fn(),
      },
    },
    loader: {
      load: vi.fn(),
      preload: vi.fn(),
    },
    emit: vi.fn(),
  }
}

describe('avatar pipeline regression coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('preserves default VRM hooks when cloning avatar nodes', async () => {
    const { BrowserLoader } = await import('../../src/core/systems/BrowserLoader.js')
    const world = createWorldStub()
    const loader = new BrowserLoader(world)
    loader.loadFile = vi.fn(async () => ({
      arrayBuffer: async () => new ArrayBuffer(0),
      size: 2048,
    }))

    loader.start()
    const avatar = await loader.load('avatar', 'asset://avatar.vrm')

    expect(createVRMFactoryMock).toHaveBeenCalled()
    expect(avatar.hooks).toMatchObject({
      camera: world.camera,
      scene: world.stage.scene,
      loader: world.loader,
    })

    const clone = avatar.toNodes()
    const avatarNode = clone.get('avatar')
    expect(avatarNode).toBeTruthy()
    expect(avatarNode.hooks).toBe(avatar.hooks)
  })

  it('allows overriding hooks for custom blendshape definitions', async () => {
    const { BrowserLoader } = await import('../../src/core/systems/BrowserLoader.js')
    const world = createWorldStub()
    const loader = new BrowserLoader(world)
    loader.loadFile = vi.fn(async () => ({
      arrayBuffer: async () => new ArrayBuffer(0),
      size: 1024,
    }))

    loader.start()
    const avatar = await loader.load('avatar', 'asset://avatar.vrm')
    const customHooks = { ...avatar.hooks, blendshapes: { smile: 0.8 } }

    const clone = avatar.toNodes(customHooks)
    const avatarNode = clone.get('avatar')

    expect(avatarNode).toBeTruthy()
    expect(avatarNode.hooks).toBe(customHooks)
    expect(avatarNode.hooks).not.toBe(avatar.hooks)
  })
})
