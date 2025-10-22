import { System } from './System'

import StatsGL from '../libs/stats-gl'
import Panel from '../libs/stats-gl/panel'
import { isBoolean } from 'lodash-es'
import { STATS_PALETTE_DEFAULT } from '../constants/statsPalettes.js'

const PING_RATE = 1 / 2

/**
 * Stats System
 *
 * - runs on the client
 * - attaches stats to the ui to see fps/cpu/gpu
 *
 */
export class ClientStats extends System {
  constructor(world) {
    super(world)
    this.stats = null
    this.ui = null
    this.active = false
    this.lastPingAt = 0
    this.pingHistory = []
    this.pingHistorySize = 30 // Store the last 30 ping measurements
    this.maxPing = 0.01 // Starting value for max (will be updated)
    this.currentPalette = STATS_PALETTE_DEFAULT
  }

  init({ ui }) {
    this.ui = ui
  }

  start() {
    this.world.prefs.on('change', this.onPrefsChange)
    this.world.on('ui', this.onUIState)
    this.world.on('ready', this.onReady)
  }

  onReady = () => {
    if (this.world.prefs.stats) {
      this.toggle(true)
    }
  }

  toggle(value) {
    value = isBoolean(value) ? value : !this.active
    if (this.active === value) return
    this.active = value
    if (this.active) {
      if (!this.stats) {
        const palette = this.world.prefs.statsPalette || STATS_PALETTE_DEFAULT
        this.stats = new StatsGL({
          logsPerSecond: 20,
          samplesLog: 100,
          samplesGraph: 10,
          precision: 2,
          horizontal: true,
          minimal: false,
          mode: 0,
          telemetryPalette: palette,
        })
        this.stats.dom.style.zIndex = null
        this.stats.init(this.world.graphics.renderer, false)
        const pingColors = this.stats.getTelemetryPanelColors('ping', { palette })
        this.ping = new Panel('PING', pingColors.fg, pingColors.bg)
        this.stats.addPanel(this.ping, 3)
        this.currentPalette = palette
      } else {
        this.applyStatsPalette(this.world.prefs.statsPalette)
      }
      this.ui.appendChild(this.stats.dom)
    } else {
      if (this.stats?.dom.parentNode === this.ui) {
        this.ui.removeChild(this.stats.dom)
      }
    }
  }

  preTick() {
    if (this.active) {
      this.stats.begin()
    }
  }

  update(delta) {
    if (!this.active) return
    this.lastPingAt += delta
    if (this.lastPingAt > PING_RATE) {
      const time = performance.now()
      this.world.network.send('ping', time)
      this.lastPingAt = 0
    }
  }

  postTick() {
    if (this.active) {
      this.stats.end()
      this.stats.update()
    }
  }

  applyStatsPalette(paletteName) {
    const nextPalette = paletteName || STATS_PALETTE_DEFAULT
    this.currentPalette = nextPalette
    if (!this.stats) return

    this.stats.setTelemetryPalette(nextPalette)
    if (this.ping) {
      const pingColors = this.stats.getTelemetryPanelColors('ping', { palette: nextPalette })
      this.ping.setColors(pingColors.fg, pingColors.bg)
    }
  }

  onPong(time) {
    const rttMs = performance.now() - time
    if (this.active && this.ping) {
      this.pingHistory.push(rttMs)
      if (this.pingHistory.length > this.pingHistorySize) {
        this.pingHistory.shift()
      }
      let sum = 0
      let min = Infinity
      let max = 0
      for (let i = 0; i < this.pingHistory.length; i++) {
        const value = this.pingHistory[i]
        sum += value
        if (value < min) min = value
        if (value > max) max = value
      }
      const avg = sum / this.pingHistory.length
      if (max > this.maxPing) {
        this.maxPing = max
      }
      this.ping.update(
        avg, // current value (average)
        rttMs, // graph value (latest ping)
        max, // max value for text display
        this.maxPing, // max value for graph scaling
        0 // number of decimal places (0 for ping)
      )
    }
    // emit an event so other systems can use ping information
    // if (this.pingHistory.length > 0) {
    //   let sum = 0
    //   let min = Infinity
    //   let max = 0
    //   for (let i = 0; i < this.pingHistory.length; i++) {
    //     const value = this.pingHistory[i]
    //     sum += value
    //     if (value < min) min = value
    //     if (value > max) max = value
    //   }
    //   this.world.emit('ping-update', {
    //     current: rttMs,
    //     average: Math.round(sum / this.pingHistory.length),
    //     min: min,
    //     max: max,
    //   })
    // }
  }

  onPrefsChange = changes => {
    if (changes.stats) {
      this.toggle(changes.stats.value)
    }
    if (changes.statsPalette) {
      this.applyStatsPalette(changes.statsPalette.value)
    }
  }

  onUIState = state => {
    if (this.active && !state.visible) {
      this.uiHidden = true
      this.toggle(false)
    } else if (this.uiHidden && state.visible) {
      this.uiHidden = null
      this.toggle(true)
    }
  }

  destroy() {
    this.toggle(false)
  }
}
