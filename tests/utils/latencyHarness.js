export function createLatencyInjector(profile = {}, scheduler = defaultScheduler) {
  const baseMs = Number.isFinite(profile.baseMs) ? profile.baseMs : 0
  const channelSequences = new Map(
    Object.entries(profile.channels || {}).map(([key, sequence]) => [key, Array.isArray(sequence) ? sequence.slice() : []]),
  )
  const defaultSequence = Array.isArray(profile.sequence) ? profile.sequence.slice() : []
  const cursors = new Map()

  function nextEntry(label) {
    const sequence = channelSequences.get(label) ?? defaultSequence
    if (sequence.length === 0) return {}
    const index = cursors.get(label) ?? 0
    cursors.set(label, (index + 1) % sequence.length)
    return sequence[index] ?? {}
  }

  function schedule(label, callback, baseDelay = 0) {
    const entry = nextEntry(label)
    if (entry.drop) return null
    const offset = Number.isFinite(entry.offsetMs) ? entry.offsetMs : 0
    const delay = Math.max(0, baseMs + baseDelay + offset)
    return scheduler(callback, delay, label)
  }

  return { schedule }
}

function defaultScheduler(callback, delay) {
  return setTimeout(callback, delay)
}
