#!/usr/bin/env node

import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

const DEFAULT_URL = process.env.HYPERFY_DIAGNOSTICS_URL ?? 'http://localhost:3000'

function printUsage() {
  console.log(`Usage: npm run diagnostics -- [options]\n\n` +
    `Options:\n` +
    `  --url <url>        Base URL for the Hyperfy server (default: ${DEFAULT_URL})\n` +
    `  --watch            Continuously poll /metrics and stream summaries\n` +
    `  --interval <sec>   Interval in seconds when using --watch (default: 10)\n` +
    `  --json             Output raw JSON response\n` +
    `  -h, --help         Show this help message\n`)
}

function parseArgs(argv) {
  const options = {
    url: DEFAULT_URL,
    watch: false,
    intervalSec: 10,
    json: false,
  }

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (!arg) continue

    if (arg === '--help' || arg === '-h') {
      printUsage()
      process.exit(0)
    } else if (arg === '--url') {
      const value = argv[++index]
      if (!value) {
        throw new Error('--url requires a value')
      }
      options.url = value
    } else if (arg.startsWith('--url=')) {
      options.url = arg.slice('--url='.length)
    } else if (arg === '--watch') {
      options.watch = true
    } else if (arg === '--interval') {
      const value = argv[++index]
      if (!value) {
        throw new Error('--interval requires a value')
      }
      options.intervalSec = Number.parseFloat(value)
    } else if (arg.startsWith('--interval=')) {
      options.intervalSec = Number.parseFloat(arg.slice('--interval='.length))
    } else if (arg === '--json') {
      options.json = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!Number.isFinite(options.intervalSec) || options.intervalSec <= 0) {
    options.intervalSec = 10
  }

  return options
}

async function fetchMetrics(baseUrl) {
  const url = new URL('/metrics', baseUrl)
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Request failed with status ${response.status}: ${body || response.statusText}`)
  }

  return response.json()
}

function formatNumber(value, { digits = 1, fallback = '0.0' } = {}) {
  if (!Number.isFinite(value)) {
    return fallback
  }
  return Number.parseFloat(value).toFixed(digits)
}

function summariseZone(zone) {
  const players = zone.players ?? 0
  const cpuPercent = zone.maxCPU ? (zone.cpu / zone.maxCPU) * 100 : 0
  const memoryPercent = zone.maxMemory ? (zone.memory / zone.maxMemory) * 100 : 0
  const expectedRate = zone.ticks?.expectedRate ?? 0
  const observedRate = zone.ticks?.observedRate ?? 0
  const averageTick = zone.ticks?.averageDurationMs ?? 0
  const maxTick = zone.ticks?.maxDurationMs ?? 0
  const eventLoopP99 = zone.eventLoop?.p99Ms

  console.log(
    `• ${zone.label} (${zone.id}) — players: ${players}, tick: ${formatNumber(observedRate, { digits: 2 })}/${formatNumber(
      expectedRate,
      { digits: 2 }
    )} tps`
  )
  console.log(
    `    tick budget: avg ${formatNumber(averageTick, { digits: 2 })} ms, max ${formatNumber(maxTick, { digits: 2 })} ms`
  )
  console.log(
    `    CPU ${formatNumber(cpuPercent, { digits: 1 })}% of ${formatNumber(zone.maxCPU, { digits: 0, fallback: '0' })}% | ` +
      `Memory ${formatNumber(memoryPercent, { digits: 1 })}% of ${formatNumber(zone.maxMemory, { digits: 0, fallback: '0' })} MB`
  )
  if (Number.isFinite(eventLoopP99)) {
    console.log(`    Event loop p99: ${formatNumber(eventLoopP99, { digits: 2 })} ms`)
  } else {
    console.log('    Event loop p99: n/a')
  }

  if (Array.isArray(zone.issues) && zone.issues.length > 0) {
    console.log(`    Issues: ⚠️  ${zone.issues.join(', ')}`)
  } else {
    console.log('    Issues: ✅  none detected')
  }
}

async function run() {
  let options
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(error.message)
    printUsage()
    process.exit(1)
  }

  let iteration = 0
  do {
    try {
      const snapshot = await fetchMetrics(options.url)
      if (options.json) {
        console.log(JSON.stringify(snapshot, null, 2))
      } else {
        if (iteration > 0) {
          console.log('')
        }
        console.log(`Metrics snapshot — ${snapshot.timestamp ?? new Date().toISOString()}`)
        for (const zone of snapshot.zones ?? []) {
          summariseZone(zone)
        }
        if (!snapshot.zones || snapshot.zones.length === 0) {
          console.log('No zones reported by /metrics.')
        }
      }
    } catch (error) {
      console.error(`Failed to fetch metrics: ${error.message}`)
      if (!options.watch) {
        process.exitCode = 1
        return
      }
    }

    iteration += 1
    if (!options.watch) {
      break
    }

    await delay(options.intervalSec * 1000)
  } while (true)
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})
