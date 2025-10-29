import { createHash } from 'node:crypto'

const QUEST_STEP_TYPES = new Set(['collect', 'visit', 'defeat', 'interact', 'talk'])

function normaliseProgress(definition, progress = {}) {
  const normalised = { ...progress }
  for (const step of definition.steps ?? []) {
    if (!normalised[step.id]) {
      normalised[step.id] = {
        count: 0,
        completed: false,
        lastEvent: null,
      }
    }
  }
  return normalised
}

function applyQuestEvent(definition, progress, event) {
  if (!event || typeof event !== 'object') return progress
  const { stepId, type, amount = 1, metadata = {} } = event
  const targetStep = definition.steps?.find(step => step.id === stepId)
  if (!targetStep) return progress
  if (targetStep.type && targetStep.type !== type && QUEST_STEP_TYPES.has(targetStep.type)) {
    return progress
  }
  const entry = progress[stepId] ?? {
    count: 0,
    completed: false,
    lastEvent: null,
  }
  const required = targetStep.count ?? 1
  const increment = Number.isFinite(amount) ? amount : 1
  const nextCount = Math.max(0, entry.count + increment)
  const completed = nextCount >= required
  progress[stepId] = {
    ...entry,
    count: completed ? required : nextCount,
    completed,
    lastEvent: {
      at: metadata.at ?? Date.now(),
      description: metadata.description ?? null,
    },
  }
  return progress
}

function evaluateQuest(definition, progress) {
  const summary = {
    stepsCompleted: 0,
    stepsTotal: definition.steps?.length ?? 0,
    status: 'active',
  }
  if (!definition.steps || definition.steps.length === 0) {
    summary.status = 'ready-to-turn-in'
    return summary
  }
  for (const step of definition.steps) {
    const entry = progress[step.id]
    if (!entry) continue
    if (entry.completed) {
      summary.stepsCompleted++
    }
  }
  if (summary.stepsCompleted >= summary.stepsTotal && summary.stepsTotal > 0) {
    summary.status = 'ready-to-turn-in'
  }
  return summary
}

async function simulateQuest(payload = {}) {
  const definition = payload.definition ?? { steps: [] }
  const baseProgress = normaliseProgress(definition, payload.progress)
  const events = Array.isArray(payload.events) ? payload.events : []
  const progress = { ...baseProgress }
  for (const event of events) {
    applyQuestEvent(definition, progress, event)
  }
  const summary = evaluateQuest(definition, progress)
  return {
    progress,
    summary,
  }
}

async function aggregateMetrics(payload = {}) {
  const frames = Array.isArray(payload.frames) ? payload.frames : []
  let totalDuration = 0
  let maxDuration = 0
  for (const frame of frames) {
    if (!frame) continue
    const duration = Number(frame.durationMs ?? 0)
    if (!Number.isFinite(duration)) continue
    totalDuration += duration
    maxDuration = Math.max(maxDuration, duration)
  }
  const averageDuration = frames.length ? totalDuration / frames.length : 0
  const checksum = createHash('sha256').update(JSON.stringify(payload)).digest('hex')
  return {
    averageDuration,
    maxDuration,
    checksum,
  }
}

async function delayDiagnostics(payload = {}) {
  const duration = Math.max(0, Number(payload.durationMs ?? payload.duration ?? 0))
  if (duration > 0) {
    await new Promise(resolve => setTimeout(resolve, duration))
  }
  return {
    waitedMs: duration,
  }
}

export const taskHandlers = new Map([
  ['quest:simulate-progress', simulateQuest],
  ['metrics:aggregate-frames', aggregateMetrics],
  ['diagnostics:delay', delayDiagnostics],
])

export function hasTaskHandler(name) {
  return taskHandlers.has(name)
}
