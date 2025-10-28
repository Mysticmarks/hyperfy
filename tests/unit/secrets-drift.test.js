import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  analyzeSecrets,
  loadInventory,
  loadOverlaySecrets,
} from '../../scripts/ops/lib/secrets-drift.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..', '..')

describe('secrets drift audit', () => {
  it('matches the documented inventory with environment overlays', () => {
    const inventory = loadInventory(repoRoot)
    const overlays = loadOverlaySecrets(repoRoot)
    const result = analyzeSecrets({ inventory, overlays })

    expect(result.issues).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
    expect(result.stats.environmentsAudited).toBeGreaterThan(0)
    expect(result.stats.secretsReferenced).toBeGreaterThan(0)
  })

  it('flags overlays that reference undocumented secret fields', () => {
    const inventory = loadInventory(repoRoot)
    const overlays = loadOverlaySecrets(repoRoot).map((entry, index) => {
      if (index === 0) {
        return { ...entry, field: 'nonexistent_field' }
      }
      return entry
    })

    const result = analyzeSecrets({ inventory, overlays })

    expect(result.issues.length).toBeGreaterThan(0)
    expect(result.issues[0].message).toContain('Field nonexistent_field missing')
  })
})
