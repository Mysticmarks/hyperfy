export const STATS_PALETTE_CLASSIC = 'classic'
export const STATS_PALETTE_HIGH_CONTRAST = 'high-contrast'
export const STATS_PALETTE_DEFAULT = STATS_PALETTE_CLASSIC

export const STATS_PALETTE_OPTIONS = [
  { value: STATS_PALETTE_CLASSIC, label: 'Classic' },
  { value: STATS_PALETTE_HIGH_CONTRAST, label: 'High Contrast' },
]

const STATS_PALETTE_SET = new Set(STATS_PALETTE_OPTIONS.map(option => option.value))

export function isStatsPalette(value) {
  return typeof value === 'string' && STATS_PALETTE_SET.has(value)
}
