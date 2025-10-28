import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import YAML from 'yaml'

function resolveRepoRoot(fromPath = import.meta.url) {
  const moduleDir = path.dirname(fileURLToPath(fromPath))
  return path.resolve(moduleDir, '../../..')
}

function readYamlFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  return YAML.parse(raw) ?? {}
}

export function loadInventory(repoRoot = resolveRepoRoot(import.meta.url)) {
  const inventoryPath = path.join(repoRoot, 'config', 'secrets', 'inventory.yaml')
  if (!fs.existsSync(inventoryPath)) {
    throw new Error(`Secrets inventory not found at ${inventoryPath}`)
  }

  const data = readYamlFile(inventoryPath)
  const environments = new Map()

  for (const entry of data.environments ?? []) {
    const name = entry?.name ?? entry?.environment
    if (!name) continue

    const secrets = new Map()
    for (const secret of entry.secrets ?? []) {
      const provider = secret?.provider ?? entry?.provider ?? data?.defaults?.provider
      const identifier = secret?.name ?? secret?.secret ?? secret?.id
      if (!provider || !identifier) continue

      const key = `${provider}/${identifier}`
      const fields = new Set()
      for (const field of secret.fields ?? []) {
        if (field) fields.add(field)
      }

      secrets.set(key, {
        provider,
        identifier,
        key,
        optional: Boolean(secret?.optional ?? entry?.optional ?? false),
        fields,
        description: secret?.description ?? '',
        owners: secret?.owners ?? entry?.owners ?? data?.defaults?.owners ?? [],
        tags: secret?.tags ?? entry?.tags ?? data?.defaults?.tags ?? [],
        used: false,
        usedFields: new Set(),
      })
    }

    environments.set(name, {
      entry,
      secrets,
    })
  }

  return {
    environments,
    raw: data,
  }
}

function normalizeOverlayEnvironment(fileName, overlay) {
  if (overlay?.environment && typeof overlay.environment === 'string') {
    return overlay.environment
  }
  return path.basename(fileName, path.extname(fileName))
}

export function loadOverlaySecrets(repoRoot = resolveRepoRoot(import.meta.url)) {
  const overlaysDir = path.join(repoRoot, 'config', 'environments')
  if (!fs.existsSync(overlaysDir)) {
    throw new Error(`Environment overlays directory missing at ${overlaysDir}`)
  }

  const files = fs.readdirSync(overlaysDir).filter(name => name.endsWith('.yaml'))
  const overlays = []

  for (const fileName of files) {
    const fullPath = path.join(overlaysDir, fileName)
    const overlay = readYamlFile(fullPath)
    const environment = normalizeOverlayEnvironment(fileName, overlay)

    for (const entry of overlay?.variables ?? []) {
      if (!entry || entry.source !== 'secret') continue
      const provider = entry.provider ?? 'secret-manager'
      const identifier = entry.secret ?? entry.path
      const field = entry.field ?? null
      if (!identifier) continue

      overlays.push({
        environment,
        file: fullPath,
        variable: entry.name,
        provider,
        identifier,
        key: `${provider}/${identifier}`,
        field,
        description: entry.description ?? '',
      })
    }
  }

  return overlays
}

export function analyzeSecrets({ inventory, overlays }) {
  const issues = []
  const warnings = []
  const stats = {
    environments: new Set(),
    overlays: overlays.length,
    secretsReferenced: 0,
    fieldsReferenced: 0,
  }

  for (const overlay of overlays) {
    stats.environments.add(overlay.environment)
    const envInventory = inventory.environments.get(overlay.environment)
    if (!envInventory) {
      issues.push({
        level: 'error',
        message: `Environment "${overlay.environment}" is missing from the secrets inventory`,
        detail: `Variable ${overlay.variable} in ${overlay.file} references ${overlay.key}`,
      })
      continue
    }

    const secretRecord = envInventory.secrets.get(overlay.key)
    if (!secretRecord) {
      issues.push({
        level: 'error',
        message: `Secret ${overlay.key} is not documented for environment "${overlay.environment}"`,
        detail: `Variable ${overlay.variable} in ${overlay.file} requires this secret`,
      })
      continue
    }

    secretRecord.used = true
    stats.secretsReferenced += 1

    if (overlay.field) {
      if (!secretRecord.fields.has(overlay.field)) {
        issues.push({
          level: 'error',
          message: `Field ${overlay.field} missing from secrets inventory for ${overlay.key}`,
          detail: `Variable ${overlay.variable} in ${overlay.file}`,
        })
        continue
      }

      secretRecord.fields.delete(overlay.field)
      secretRecord.usedFields.add(overlay.field)
      stats.fieldsReferenced += 1
    }
  }

  for (const [environment, envInventory] of inventory.environments) {
    for (const secret of envInventory.secrets.values()) {
      if (!secret.used) {
        const level = secret.optional ? 'warn' : 'error'
        const bucket = level === 'warn' ? warnings : issues
        bucket.push({
          level,
          message: `Documented secret ${secret.key} for environment "${environment}" is not referenced by any overlay`,
        })
      }

      if (secret.fields.size > 0) {
        const level = secret.optional ? 'warn' : 'error'
        const bucket = level === 'warn' ? warnings : issues
        bucket.push({
          level,
          message: `Inventory fields ${Array.from(secret.fields).join(', ')} for ${secret.key} ` +
            `(${environment}) are not used by overlays`,
        })
      }
    }
  }

  return {
    issues,
    warnings,
    stats: {
      environmentsAudited: stats.environments.size,
      overlaysAnalyzed: stats.overlays,
      secretsReferenced: stats.secretsReferenced,
      fieldsReferenced: stats.fieldsReferenced,
    },
  }
}

export function formatFindings({ issues, warnings, stats }) {
  const lines = []
  lines.push('🔐 Hyperfy secrets drift audit')
  lines.push('--------------------------------')
  lines.push(
    `Environments: ${stats.environmentsAudited} | Secret refs: ${stats.secretsReferenced} | Field refs: ${stats.fieldsReferenced}`
  )

  if (issues.length === 0 && warnings.length === 0) {
    lines.push('✅ No drift detected between overlays and the inventory.')
  } else {
    for (const issue of issues) {
      lines.push(`❌ ${issue.message}` + (issue.detail ? ` — ${issue.detail}` : ''))
    }
    for (const warning of warnings) {
      lines.push(`⚠️ ${warning.message}` + (warning.detail ? ` — ${warning.detail}` : ''))
    }

    if (issues.length === 0) {
      lines.push(`⚠️ Audit completed with ${warnings.length} warning(s).`)
    } else {
      lines.push(`❌ Audit failed with ${issues.length} blocking issue(s) and ${warnings.length} warning(s).`)
    }
  }

  return lines
}

export function runAudit({ inventoryRoot } = {}) {
  const repoRoot = inventoryRoot ?? resolveRepoRoot(import.meta.url)
  const inventory = loadInventory(repoRoot)
  const overlays = loadOverlaySecrets(repoRoot)
  return analyzeSecrets({ inventory, overlays })
}

export function executeCli() {
  try {
    const result = runAudit()
    const output = formatFindings(result)
    for (const line of output) {
      console.log(line)
    }
    if (result.issues.length > 0) {
      process.exitCode = 1
    }
  } catch (error) {
    console.error('❌ Secrets drift audit failed:', error.message)
    process.exitCode = 1
  }
}
