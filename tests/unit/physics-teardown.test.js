import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const destroyMock = vi.fn()

vi.mock('../../src/core/extras/three.js', async () => {
  const actual = await vi.importActual('../../src/core/extras/three.js')
  return actual
})

beforeEach(() => {
  vi.stubGlobal('PHYSX', { destroy: destroyMock })
})

afterEach(() => {
  destroyMock.mockClear()
  vi.unstubAllGlobals()
})

describe('Physics.destroy', () => {
  it('releases query resources to avoid leaks', async () => {
    const { Physics } = await import('../../src/core/systems/Physics.js')
    const physics = new Physics({})

    const resources = {
      raycastResult: {},
      sweepPose: {},
      sweepResult: {},
      overlapPose: {},
      overlapResult: {},
      queryFilterData: {},
      _pv1: {},
      _pv2: {},
      transform: {},
    }

    Object.assign(physics, resources)

    physics.destroy()

    expect(destroyMock).toHaveBeenCalledTimes(Object.keys(resources).length)
    for (const value of Object.values(resources)) {
      expect(destroyMock).toHaveBeenCalledWith(value)
    }
  })
})
