#!/usr/bin/env node
import { constants as fsConstants } from 'node:fs'
import { access } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import { getServerConfig } from '../../src/server/config.js'
import { TaskPool } from '../../src/server/runtime/TaskPool.js'

const checks = []

function record(status, title, detail = '') {
  checks.push({ status, title, detail })
  const symbol = status === 'pass' ? '✅' : status === 'warn' ? '⚠️' : '❌'
  const message = detail ? `${title} — ${detail}` : title
  if (status === 'pass') {
    console.log(`${symbol} ${message}`)
  } else if (status === 'warn') {
    console.warn(`${symbol} ${message}`)
  } else {
    console.error(`${symbol} ${message}`)
  }
}

async function verifyEnvVariables(vars) {
  const missing = vars.filter(name => {
    const value = process.env[name]
    return value === undefined || value === null || String(value).trim() === ''
  })
  if (missing.length === 0) {
    record('pass', 'Environment variables present', vars.join(', '))
  } else {
    record('fail', 'Missing required environment variables', missing.join(', '))
  }
}

async function verifyPath(label, targetPath) {
  try {
    await access(targetPath, fsConstants.R_OK)
    record('pass', `${label} accessible`, targetPath)
  } catch (error) {
    record('fail', `${label} missing`, `${targetPath} (${error.message})`)
  }
}

async function verifyTaskPool() {
  const pool = new TaskPool({ size: Math.min(2, Math.max(1, (os.cpus()?.length ?? 1) - 1)) })
  try {
    const result = await pool.run('metrics:aggregate-frames', {
      frames: [
        { durationMs: 4.2 },
        { durationMs: 5.6 },
      ],
    })
    if (!Number.isFinite(result.averageDuration)) {
      throw new Error('Invalid average duration from task pool')
    }
    record('pass', 'Worker thread task pool online', `avg tick duration ${result.averageDuration.toFixed(2)}ms`)
  } catch (error) {
    record('fail', 'Worker thread task pool failed', error.message)
  } finally {
    await pool.destroy()
  }
}

async function main() {
  console.log('🧪 Hyperfy deployment preflight checks')
  console.log('------------------------------------')

  const requiredEnv = [
    'WORLD',
    'FASTIFY_JWT_SECRET',
    'FASTIFY_ADMIN_CODE',
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
    'DATABASE_URL',
    'CDN_BUCKET_NAME',
    'CDN_SIGNING_KEY',
  ]
  await verifyEnvVariables(requiredEnv)

  try {
    const config = getServerConfig()
    record('pass', 'Server configuration parsed', `world=${config.world.dir}`)
    await verifyPath('World directory', config.world.dir)
    await verifyPath('Assets directory', config.world.assetsDir)
    await verifyPath('Collections directory', config.world.collectionsDir)
  } catch (error) {
    record('fail', 'Server configuration failed', error.message)
  }

  const buildOutput = path.join(process.cwd(), 'build', 'index.js')
  await verifyPath('Build output', buildOutput)

  await verifyTaskPool()

  const failed = checks.filter(check => check.status === 'fail')
  const warned = checks.filter(check => check.status === 'warn')

  console.log('------------------------------------')
  if (failed.length === 0) {
    if (warned.length === 0) {
      console.log('✅ Preflight completed with no blocking issues.')
    } else {
      console.log(`⚠️ Preflight completed with ${warned.length} warnings.`)
    }
  } else {
    console.error(`❌ Preflight failed with ${failed.length} blocking issue(s).`)
    process.exitCode = 1
  }
}

main().catch(error => {
  console.error('❌ Preflight crashed:', error)
  process.exitCode = 1
})
