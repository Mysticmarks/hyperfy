const KEY_ALIAS = {
  '?': '/',
  'arrowup': 'arrowup',
  'arrowdown': 'arrowdown',
  'arrowleft': 'arrowleft',
  'arrowright': 'arrowright',
  ' ': 'space',
}

export function parseBinding(binding) {
  if (typeof binding !== 'string' || !binding.trim()) {
    return null
  }
  const tokens = binding
    .split('+')
    .map(token => token.trim().toLowerCase())
    .filter(Boolean)
  const combo = {
    alt: false,
    ctrl: false,
    meta: false,
    shift: false,
    key: null,
  }
  for (const token of tokens) {
    if (token === 'ctrl' || token === 'control' || token === 'cmdctrl') {
      combo.ctrl = true
    } else if (token === 'cmd' || token === 'meta' || token === '⌘') {
      combo.meta = true
    } else if (token === 'alt' || token === 'option') {
      combo.alt = true
    } else if (token === 'shift') {
      combo.shift = true
    } else {
      combo.key = KEY_ALIAS[token] || token
    }
  }
  return combo
}

export function matchesBinding(event, binding) {
  const combo = parseBinding(binding)
  if (!combo) return false
  const key = (event.key || '').toLowerCase()
  const normalizedKey = KEY_ALIAS[key] || key
  if (combo.key && combo.key !== normalizedKey) {
    return false
  }
  const ctrlOrMeta = event.ctrlKey || event.metaKey
  if (combo.ctrl && !ctrlOrMeta) return false
  if (!combo.ctrl && ctrlOrMeta && combo.key === normalizedKey && normalizedKey.length === 1) {
    // allow meta use when not explicitly required for printable keys
  }
  if (combo.meta && !event.metaKey) return false
  if (combo.alt !== event.altKey) return false
  if (combo.shift !== event.shiftKey) return false
  if (!combo.ctrl && event.ctrlKey && !event.metaKey) return false
  if (!combo.meta && event.metaKey && !combo.ctrl) return false
  return true
}

export function bindingToHumanReadable(binding) {
  const combo = parseBinding(binding)
  if (!combo) return ''
  const parts = []
  if (combo.ctrl) parts.push(window.navigator?.platform.includes('Mac') ? '⌘' : 'Ctrl')
  if (combo.meta && !combo.ctrl) parts.push('⌘')
  if (combo.alt) parts.push('Alt')
  if (combo.shift) parts.push('Shift')
  if (combo.key) {
    if (combo.key.length === 1) {
      parts.push(combo.key.toUpperCase())
    } else if (combo.key === 'space') {
      parts.push('Space')
    } else if (combo.key.startsWith('arrow')) {
      parts.push(combo.key.replace('arrow', 'Arrow '))
    } else if (combo.key === '/') {
      parts.push('?')
    } else {
      parts.push(combo.key.replace(/\b\w/g, letter => letter.toUpperCase()))
    }
  }
  return parts.join(' + ')
}
