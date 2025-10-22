import { describe, it, expect, vi } from 'vitest'

import { Avatars } from '../../src/core/systems/Avatars.js'

describe('Avatars system rendering smoke test', () => {
  it('amortises avatar rate updates across frames', () => {
    const world = {}
    const system = new Avatars(world)

    const avatarA = { updateRate: vi.fn() }
    const avatarB = { updateRate: vi.fn() }
    const avatarC = { updateRate: vi.fn() }

    system.add(avatarA)
    system.add(avatarB)
    system.add(avatarC)

    system.update()
    expect(avatarA.updateRate).toHaveBeenCalledTimes(1)

    system.update()
    expect(avatarB.updateRate).toHaveBeenCalledTimes(1)

    system.update()
    expect(avatarC.updateRate).toHaveBeenCalledTimes(1)

    system.remove(avatarB)
    system.update()
    expect(avatarC.updateRate).toHaveBeenCalledTimes(2)

    system.update()
    expect(avatarA.updateRate).toHaveBeenCalledTimes(2)

    system.destroy()
    expect(system.avatars.length).toBe(0)
  })
})
