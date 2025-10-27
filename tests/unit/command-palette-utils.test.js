import { describe, expect, it } from 'vitest'

import { highlightMatch, scoreCommands } from '../../src/client/components/commandPaletteUtils.js'

describe('command palette utils', () => {
  it('ranks commands by fuzzy score', () => {
    const commands = [
      { id: '1', title: 'Open Settings', description: 'Configure preferences', tags: ['settings'] },
      { id: '2', title: 'Save World', description: 'Persist current changes' },
      { id: '3', title: 'Spawn Companion', description: 'Summon a friendly unit', tags: ['spawn'] },
    ]
    const ranked = scoreCommands(commands, 'save')
    expect(ranked.map(entry => entry.command.id)).toEqual(['2'])
  })

  it('splits highlight segments for matched text', () => {
    const segments = highlightMatch('Save World', 'wo')
    expect(segments).toHaveLength(3)
    expect(segments[1].highlight).toBe(true)
    expect(segments[1].text.toLowerCase()).toBe('wo')
  })
})
