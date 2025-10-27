import { isBoolean, isNumber } from 'lodash-es'

import { System } from './System'
import { storage } from '../storage'
import { isTouch } from '../../client/utils'
import { isStatsPalette, STATS_PALETTE_DEFAULT } from '../constants/statsPalettes.js'

const THEME_MODES = new Set(['dark', 'light', 'system'])
const THEME_DEFAULT_MODE = 'dark'
const THEME_DEFAULT_PRIMARY_HUE = 265
const THEME_DEFAULT_NEUTRAL_HUE = 220

const MOTION_MODES = new Set(['system', 'comfortable', 'reduced'])
const MOTION_DEFAULT_MODE = 'system'

const TYPOGRAPHY_SCALES = new Set(['standard', 'large', 'xlarge'])
const TYPOGRAPHY_DEFAULT_SCALE = 'standard'

const COLORBLIND_FILTERS = new Set(['none', 'protanopia', 'deuteranopia', 'tritanopia'])
const COLORBLIND_DEFAULT_FILTER = 'none'

const DEFAULT_INPUT_BINDINGS = {
  openMenu: 'ctrl+shift+p',
  openCommandPalette: 'ctrl+k',
  openHelp: 'shift+/',
  showShortcuts: 'shift+?',
  toggleTours: 'alt+t',
}

/**
 * Client Prefs System
 *
 */
export class ClientPrefs extends System {
  constructor(world) {
    super(world)

    const isQuest = /OculusBrowser/.test(navigator.userAgent)

    const data = storage.get('prefs', {})

    // v2: reset ui scale for new mobile default (0.9)
    if (!data.v) {
      data.v = 2
      data.ui = null
    }
    // v3: reset shadows for new mobile default (med)
    if (data.v < 3) {
      data.v = 3
      data.shadows = null
    }
    // v4: reset shadows for new defaults (low or med)
    if (data.v < 4) {
      data.v = 4
      data.shadows = null
    }
    if (data.v < 5) {
      data.v = 5
      data.statsPalette = null
    }
    if (data.v < 6) {
      data.v = 6
      data.themeMode = null
      data.themeHuePrimary = null
      data.themeHueNeutral = null
    }
    if (data.v < 7) {
      data.v = 7
      data.motionMode = null
      data.typographyScale = null
      data.highContrast = null
      data.accessibleFocus = null
      data.colorblindFilter = null
      data.textToSpeech = null
      data.inputBindings = null
      data.toursSeen = null
    }

    this.ui = isNumber(data.ui) ? data.ui : isTouch ? 0.9 : 1
    this.actions = isBoolean(data.actions) ? data.actions : true
    this.stats = isBoolean(data.stats) ? data.stats : false
    this.statsPalette = isStatsPalette(data.statsPalette) ? data.statsPalette : STATS_PALETTE_DEFAULT
    this.themeMode = THEME_MODES.has(data.themeMode) ? data.themeMode : THEME_DEFAULT_MODE
    this.themeHuePrimary = isNumber(data.themeHuePrimary)
      ? normalizeHue(data.themeHuePrimary, THEME_DEFAULT_PRIMARY_HUE)
      : THEME_DEFAULT_PRIMARY_HUE
    this.themeHueNeutral = isNumber(data.themeHueNeutral)
      ? normalizeHue(data.themeHueNeutral, THEME_DEFAULT_NEUTRAL_HUE)
      : THEME_DEFAULT_NEUTRAL_HUE
    this.motionMode = MOTION_MODES.has(data.motionMode) ? data.motionMode : MOTION_DEFAULT_MODE
    this.typographyScale = TYPOGRAPHY_SCALES.has(data.typographyScale) ? data.typographyScale : TYPOGRAPHY_DEFAULT_SCALE
    this.highContrast = isBoolean(data.highContrast) ? data.highContrast : false
    this.accessibleFocus = isBoolean(data.accessibleFocus) ? data.accessibleFocus : true
    this.colorblindFilter = COLORBLIND_FILTERS.has(data.colorblindFilter)
      ? data.colorblindFilter
      : COLORBLIND_DEFAULT_FILTER
    this.textToSpeech = isBoolean(data.textToSpeech) ? data.textToSpeech : false
    this.inputBindings = normalizeInputBindings(data.inputBindings)
    this.toursSeenSet = new Set(Array.isArray(data.toursSeen) ? data.toursSeen : [])
    this.dpr = isNumber(data.dpr) ? data.dpr : 1
    this.shadows = data.shadows ? data.shadows : isTouch ? 'low' : 'med' // none, low=1, med=2048cascade, high=4096cascade
    this.postprocessing = isBoolean(data.postprocessing) ? data.postprocessing : true
    this.bloom = isBoolean(data.bloom) ? data.bloom : true
    this.ao = isBoolean(data.ao) ? data.ao : true
    this.music = isNumber(data.music) ? data.music : 1
    this.sfx = isNumber(data.sfx) ? data.sfx : 1
    this.voice = isNumber(data.voice) ? data.voice : 1
    this.v = data.v

    this.changes = null
  }

  preFixedUpdate() {
    if (!this.changes) return
    this.emit('change', this.changes)
    this.changes = null
  }

  modify(key, value) {
    if (this[key] === value) return
    const prev = this[key]
    this[key] = value
    if (!this.changes) this.changes = {}
    if (!this.changes[key]) this.changes[key] = { prev, value: null }
    this.changes[key].value = value
    this.persist()
  }

  async persist() {
    // a small delay to ensure prefs that crash dont persist (eg old iOS with UHD shadows etc)
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now()
    await new Promise(resolve => setTimeout(resolve, 2000))
    const data = {
      ui: this.ui,
      actions: this.actions,
      stats: this.stats,
      statsPalette: this.statsPalette,
      themeMode: this.themeMode,
      themeHuePrimary: this.themeHuePrimary,
      themeHueNeutral: this.themeHueNeutral,
      motionMode: this.motionMode,
      typographyScale: this.typographyScale,
      highContrast: this.highContrast,
      accessibleFocus: this.accessibleFocus,
      colorblindFilter: this.colorblindFilter,
      textToSpeech: this.textToSpeech,
      inputBindings: this.inputBindings,
      toursSeen: Array.from(this.toursSeenSet),
      dpr: this.dpr,
      shadows: this.shadows,
      postprocessing: this.postprocessing,
      bloom: this.bloom,
      ao: this.ao,
      music: this.music,
      sfx: this.sfx,
      voice: this.voice,
      v: this.v,
    }
    storage.set('prefs', data)
    const end = typeof performance !== 'undefined' ? performance.now() : Date.now()
    this.world.emit('telemetry', {
      source: 'prefs',
      event: 'persisted',
      duration: end - start,
      snapshot: {
        themeMode: this.themeMode,
        themeHuePrimary: this.themeHuePrimary,
        themeHueNeutral: this.themeHueNeutral,
      },
    })
  }

  setUI(value) {
    this.modify('ui', value)
  }

  setActions(value) {
    this.modify('actions', value)
  }

  setStats(value) {
    this.modify('stats', value)
  }

  setStatsPalette(value) {
    if (!isStatsPalette(value)) {
      value = STATS_PALETTE_DEFAULT
    }
    this.modify('statsPalette', value)
  }

  setDPR(value) {
    this.modify('dpr', value)
  }

  setShadows(value) {
    this.modify('shadows', value)
  }

  setPostprocessing(value) {
    this.modify('postprocessing', value)
  }

  setBloom(value) {
    this.modify('bloom', value)
  }

  setAO(value) {
    this.modify('ao', value)
  }

  setMusic(value) {
    this.modify('music', value)
  }

  setSFX(value) {
    this.modify('sfx', value)
  }

  setVoice(value) {
    this.modify('voice', value)
  }

  setThemeMode(value) {
    if (!THEME_MODES.has(value)) {
      value = THEME_DEFAULT_MODE
    }
    this.modify('themeMode', value)
  }

  setThemeHuePrimary(value) {
    this.modify('themeHuePrimary', normalizeHue(value, THEME_DEFAULT_PRIMARY_HUE))
  }

  setThemeHueNeutral(value) {
    this.modify('themeHueNeutral', normalizeHue(value, THEME_DEFAULT_NEUTRAL_HUE))
  }

  setMotionMode(value) {
    if (!MOTION_MODES.has(value)) {
      value = MOTION_DEFAULT_MODE
    }
    this.modify('motionMode', value)
  }

  setTypographyScale(value) {
    if (!TYPOGRAPHY_SCALES.has(value)) {
      value = TYPOGRAPHY_DEFAULT_SCALE
    }
    this.modify('typographyScale', value)
  }

  setHighContrast(value) {
    this.modify('highContrast', Boolean(value))
  }

  setAccessibleFocus(value) {
    this.modify('accessibleFocus', Boolean(value))
  }

  setColorblindFilter(value) {
    if (!COLORBLIND_FILTERS.has(value)) {
      value = COLORBLIND_DEFAULT_FILTER
    }
    this.modify('colorblindFilter', value)
  }

  setTextToSpeech(value) {
    this.modify('textToSpeech', Boolean(value))
  }

  setInputBinding(action, shortcut) {
    const bindings = { ...this.inputBindings }
    if (typeof shortcut === 'string' && shortcut.trim()) {
      bindings[action] = shortcut.trim().toLowerCase()
    } else {
      bindings[action] = DEFAULT_INPUT_BINDINGS[action]
    }
    this.modify('inputBindings', bindings)
  }

  markTourSeen(id) {
    if (this.toursSeenSet.has(id)) return
    const next = new Set(this.toursSeenSet)
    next.add(id)
    this.toursSeenSet = next
    this.modify('toursSeen', Array.from(next))
  }

  destroy() {
    // ...
  }
}

function normalizeHue(value, fallback) {
  if (!isNumber(value)) return fallback
  const hue = value % 360
  return hue < 0 ? hue + 360 : hue
}

function normalizeInputBindings(bindings) {
  const normalized = { ...DEFAULT_INPUT_BINDINGS }
  if (!bindings || typeof bindings !== 'object') {
    return normalized
  }
  for (const key of Object.keys(DEFAULT_INPUT_BINDINGS)) {
    const value = bindings[key]
    if (typeof value === 'string' && value.trim()) {
      normalized[key] = value.trim().toLowerCase()
    }
  }
  return normalized
}
