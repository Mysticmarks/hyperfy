export const DEFAULT_PRIMARY_HUE = 265
export const DEFAULT_NEUTRAL_HUE = 220
export const THEME_MODES = ['dark', 'light', 'system']

const MOTION_MODE_VALUES = ['system', 'comfortable', 'reduced']
const TYPOGRAPHY_SCALES = ['standard', 'large', 'xlarge']
const COLORBLIND_FILTERS = new Map([
  ['none', 'none'],
  ['protanopia', 'grayscale(0.2) saturate(1.05) hue-rotate(-12deg)'],
  ['deuteranopia', 'grayscale(0.15) saturate(1.05) hue-rotate(-6deg)'],
  ['tritanopia', 'grayscale(0.15) saturate(1.1) hue-rotate(35deg)'],
])

export function normalizeThemePrefs(prefs = {}) {
  const themeMode = THEME_MODES.includes(prefs.themeMode) ? prefs.themeMode : 'dark'
  const themeHuePrimary = isFinite(prefs.themeHuePrimary) ? clampHue(prefs.themeHuePrimary) : DEFAULT_PRIMARY_HUE
  const themeHueNeutral = isFinite(prefs.themeHueNeutral) ? clampHue(prefs.themeHueNeutral) : DEFAULT_NEUTRAL_HUE
  const motionMode = MOTION_MODE_VALUES.includes(prefs.motionMode) ? prefs.motionMode : 'system'
  const typographyScale = TYPOGRAPHY_SCALES.includes(prefs.typographyScale) ? prefs.typographyScale : 'standard'
  const highContrast = Boolean(prefs.highContrast)
  const accessibleFocus = prefs.accessibleFocus !== false
  const colorblindFilter = COLORBLIND_FILTERS.has(prefs.colorblindFilter)
    ? prefs.colorblindFilter
    : 'none'
  return {
    themeMode,
    themeHuePrimary,
    themeHueNeutral,
    motionMode,
    typographyScale,
    highContrast,
    accessibleFocus,
    colorblindFilter,
  }
}

export function applyThemeFromPrefs(prefs) {
  const { themeMode, themeHuePrimary, themeHueNeutral, motionMode, typographyScale, highContrast, accessibleFocus, colorblindFilter } =
    normalizeThemePrefs(prefs)
  const resolvedMode = resolveThemeMode(themeMode)
  const root = document.documentElement
  root.dataset.theme = resolvedMode
  root.style.setProperty('--hf-primary-hue', String(themeHuePrimary))
  root.style.setProperty('--hf-neutral-hue', String(themeHueNeutral))
  const motion = resolveMotionTokens(motionMode)
  root.style.setProperty('--hf-motion-duration-fast', motion.fast)
  root.style.setProperty('--hf-motion-duration-medium', motion.medium)
  root.style.setProperty('--hf-motion-duration-slow', motion.slow)
  root.style.setProperty('--hf-motion-ease-standard', motion.easing)
  const typography = resolveTypographyTokens(typographyScale)
  for (const [key, value] of Object.entries(typography)) {
    root.style.setProperty(`--hf-font-${key}`, value)
  }
  root.style.setProperty('--hf-color-focus', highContrast ? 'hsl(var(--hf-primary-hue) 96% 72%)' : 'hsl(var(--hf-primary-hue) 92% 72%)')
  root.style.setProperty('--hf-color-focus-ring', accessibleFocus ? 'var(--hf-color-focus)' : 'transparent')
  root.style.setProperty('--hf-focus-ring-width', accessibleFocus ? '0.1875rem' : '0')
  root.style.setProperty('--hf-focus-ring-offset', accessibleFocus ? '0.125rem' : '0')
  root.style.setProperty('--hf-color-interaction-hover', highContrast ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.06)')
  root.style.setProperty('--hf-color-interaction-active', highContrast ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.12)')
  root.style.setProperty('--hf-colorblind-filter', COLORBLIND_FILTERS.get(colorblindFilter) || 'none')
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

function resolveMotionTokens(mode) {
  if (mode === 'reduced') {
    return {
      fast: '0ms',
      medium: '0ms',
      slow: '0ms',
      easing: 'linear',
    }
  }
  if (mode === 'comfortable') {
    return {
      fast: '140ms',
      medium: '200ms',
      slow: '320ms',
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    }
  }
  return {
    fast: '120ms',
    medium: '180ms',
    slow: '280ms',
    easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)',
  }
}

function resolveTypographyTokens(scale) {
  switch (scale) {
    case 'large':
      return {
        size: '17px',
        'size-sm': '15px',
        'size-lg': '19px',
        heading: '1.25rem',
        title: '1.45rem',
      }
    case 'xlarge':
      return {
        size: '18px',
        'size-sm': '16px',
        'size-lg': '20px',
        heading: '1.35rem',
        title: '1.6rem',
      }
    default:
      return {
        size: '16px',
        'size-sm': '14px',
        'size-lg': '18px',
        heading: '1.2rem',
        title: '1.4rem',
      }
  }
}
