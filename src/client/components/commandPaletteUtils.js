function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function scoreCommands(commands, rawQuery) {
  const query = rawQuery?.trim()?.toLowerCase() ?? ''
  if (!query) {
    return commands.map((command, index) => ({ command, score: 0, index }))
  }
  return commands
    .map((command, index) => {
      const haystacks = [command.title, command.description, ...(command.tags ?? []), command.group]
        .filter(Boolean)
        .map(value => String(value).toLowerCase())
      let bestScore = -Infinity
      for (const haystack of haystacks) {
        const position = haystack.indexOf(query)
        if (position === -1) continue
        const score = 100 - position * 2
        bestScore = Math.max(bestScore, score)
      }
      const startsWith = command.title?.toLowerCase().startsWith(query)
      if (startsWith) {
        bestScore = Math.max(bestScore, 200 - query.length)
      }
      if (command.tags?.some(tag => tag.toLowerCase() === query)) {
        bestScore = Math.max(bestScore, 150)
      }
      return { command, score: bestScore, index }
    })
    .filter(entry => entry.score > -Infinity)
    .sort((a, b) => {
      if (b.score === a.score) {
        return a.index - b.index
      }
      return b.score - a.score
    })
}

export function highlightMatch(text, rawQuery) {
  const safeText = text ?? ''
  const query = rawQuery?.trim()
  if (!query) {
    return [{ text: safeText, highlight: false }]
  }
  const pattern = new RegExp(`(${escapeRegExp(query)})`, 'ig')
  const segments = []
  let lastIndex = 0
  let match
  while ((match = pattern.exec(safeText)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: safeText.slice(lastIndex, match.index), highlight: false })
    }
    segments.push({ text: match[0], highlight: true })
    lastIndex = pattern.lastIndex
  }
  if (lastIndex < safeText.length) {
    segments.push({ text: safeText.slice(lastIndex), highlight: false })
  }
  return segments.length > 0 ? segments : [{ text: safeText, highlight: false }]
}
