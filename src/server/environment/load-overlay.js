import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import YAML from 'yaml'

const overlayName = process.env.HYPERFY_ENVIRONMENT

if (!overlayName) {
  // No overlay requested; rely on runtime-provided environment variables.
  return
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(moduleDir, '../../..')
const overlayPath = path.join(repoRoot, 'config', 'environments', `${overlayName}.yaml`)

if (!fs.existsSync(overlayPath)) {
  console.warn(
    `[hyperfy] Requested environment overlay "${overlayName}" not found at ${overlayPath}. ` +
      'Ensure config/environments contains the expected file or unset HYPERFY_ENVIRONMENT.'
  )
  return
}

try {
  const raw = fs.readFileSync(overlayPath, 'utf8')
  const overlay = YAML.parse(raw) ?? {}
  const applied = []

  for (const entry of overlay.variables ?? []) {
    if (!entry?.name) continue
    if (process.env[entry.name]) continue

    if (entry.source === 'static' && typeof entry.value !== 'undefined') {
      process.env[entry.name] = `${entry.value}`
      applied.push(entry.name)
      continue
    }

    if (entry.source === 'secret') {
      const provider = entry.provider ?? 'secret-manager'
      const secretRef = entry.secret ?? entry.path
      if (!secretRef) continue
      const fieldSuffix = entry.field ? `#${entry.field}` : ''
      const placeholder = entry.placeholder ?? `secret://${provider}/${secretRef}${fieldSuffix}`
      process.env[entry.name] = placeholder
      applied.push(entry.name)
    }
  }

  // Surface the parsed overlay for downstream tooling (tests, diagnostics, etc.).
  globalThis.hyperfyEnvironmentOverlay = Object.freeze({ ...overlay, applied })

  if (applied.length > 0) {
    console.info(`[hyperfy] Loaded environment overlay "${overlayName}" for ${applied.length} variables.`)
  }
} catch (error) {
  console.error(`[hyperfy] Failed to parse environment overlay ${overlayName}:`, error)
}
