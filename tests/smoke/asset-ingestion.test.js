import { describe, it, expect, vi } from 'vitest'
import { MockNode } from '../utils/mockNode.js'

const parseAsyncMock = vi.fn(async () => ({ scene: {}, userData: {} }))
const createVRMFactoryMock = vi.fn(() => ({
  create: vi.fn(() => ({
    setEmote: vi.fn(),
    setVisible: vi.fn(),
    disableRateCheck: vi.fn(),
    destroy: vi.fn(),
    updateRate: vi.fn(),
    getHeadToHeight: () => 1.6,
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

describe('BrowserLoader asset ingestion smoke test', () => {
  it('ingests VRM avatars and exposes cached statistics', async () => {
    const { BrowserLoader } = await import('../../src/core/systems/BrowserLoader.js')
    const world = createWorldStub()
    const loader = new BrowserLoader(world)
    loader.loadFile = vi.fn(async () => ({
      arrayBuffer: async () => new ArrayBuffer(0),
      size: 4096,
    }))

    loader.start()
    const avatar = await loader.load('avatar', 'asset://avatar.vrm')

    expect(createVRMFactoryMock).toHaveBeenCalled()
    expect(parseAsyncMock).toHaveBeenCalled()

    const stats = avatar.getStats()
    expect(stats.fileBytes).toBe(4096)

    const cached = await loader.load('avatar', 'asset://avatar.vrm')
    expect(cached).toBe(avatar)
  })
})
