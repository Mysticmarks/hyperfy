export const DEFAULT_PRIMARY_HUE = 265
export const DEFAULT_NEUTRAL_HUE = 220
export const THEME_MODES = ['dark', 'light', 'system']

export function normalizeThemePrefs(prefs = {}) {
  const themeMode = THEME_MODES.includes(prefs.themeMode) ? prefs.themeMode : 'dark'
  const themeHuePrimary = isFinite(prefs.themeHuePrimary) ? clampHue(prefs.themeHuePrimary) : DEFAULT_PRIMARY_HUE
  const themeHueNeutral = isFinite(prefs.themeHueNeutral) ? clampHue(prefs.themeHueNeutral) : DEFAULT_NEUTRAL_HUE
  return { themeMode, themeHuePrimary, themeHueNeutral }
}

export function applyThemeFromPrefs(prefs) {
  const { themeMode, themeHuePrimary, themeHueNeutral } = normalizeThemePrefs(prefs)
  const resolvedMode = resolveThemeMode(themeMode)
  const root = document.documentElement
  root.dataset.theme = resolvedMode
  root.style.setProperty('--hf-primary-hue', String(themeHuePrimary))
  root.style.setProperty('--hf-neutral-hue', String(themeHueNeutral))
  return { themeMode: resolvedMode, themeHuePrimary, themeHueNeutral }
}

export function watchSystemTheme(onChange) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {}
  }
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  if (!media.addEventListener) {
    media.addListener(onChange)
    return () => media.removeListener(onChange)
  }
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function resolveThemeMode(mode) {
  if (mode !== 'system') {
    return mode
  }
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark'
  }
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  return media.matches ? 'dark' : 'light'
}

function clampHue(value) {
  if (!isFinite(value)) return DEFAULT_PRIMARY_HUE
  const mod = value % 360
  return mod < 0 ? mod + 360 : mod
}
