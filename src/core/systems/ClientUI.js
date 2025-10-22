import { isBoolean } from 'lodash-es'
import { ControlPriorities } from '../extras/ControlPriorities'
import { System } from './System'

const appPanes = ['app', 'script', 'nodes', 'meta']

export class ClientUI extends System {
  constructor(world) {
    super(world)
    this.state = {
      visible: true,
      active: false,
      app: null,
      pane: null,
      menu: null,
      apps: false,
      reticleSuppressors: 0,
    }
    this.lastAppPane = 'app'
    this.control = null
  }

  start() {
    this.control = this.world.controls.bind({ priority: ControlPriorities.CORE_UI })
  }

  getLocalizedString(key, fallback) {
    const sources = [this.world.language, this.world.locale, this.world.i18n]
    const tryFromSource = source => {
      if (!source) return null
      const callMaybe = fn => {
        if (typeof fn !== 'function') return null
        try {
          const result = fn.call(source, key, fallback)
          return typeof result === 'string' ? result : null
        } catch (err) {
          return null
        }
      }
      const fromFunction =
        callMaybe(source.t) || callMaybe(source.translate) || callMaybe(source.get)
      if (fromFunction) return fromFunction
      if (typeof source[key] === 'string') return source[key]
      if (source.strings && typeof source.strings[key] === 'string') {
        return source.strings[key]
      }
      return null
    }
    for (const source of sources) {
      const localized = tryFromSource(source)
      if (localized) return localized
    }
    return fallback
  }

  update() {
    const ctrlDown =
      this.control.controlLeft.down || this.control.controlRight.down || this.control.metaLeft.down
    const shiftDown = this.control.shiftLeft.down || this.control.shiftRight.down
    const altDown = this.control.altLeft.down || this.control.altRight.down

    if (this.control.escape.pressed) {
      if (this.state.menu) {
        this.setMenu(null)
      } else if (this.state.apps) {
        this.toggleApps(false)
      } else if (this.state.pane) {
        this.state.pane = null
        this.broadcast()
      } else if (this.state.app) {
        this.state.app = null
        this.broadcast()
      } else {
        this.setMenu({ type: 'main' })
      }
    }

    if (this.control.keyP.pressed && ctrlDown && shiftDown) {
      this.toggleMenu('main')
    }

    if (this.control.keyA.pressed && ctrlDown && shiftDown) {
      this.toggleApps()
    }

    if (this.control.slash.pressed && shiftDown && !ctrlDown && !altDown) {
      this.setMenu({ type: 'main', page: 'help' })
    }

    if (!ctrlDown && !shiftDown && this.control.keyZ.pressed) {
      this.state.visible = !this.state.visible
      this.broadcast()
    }

    if (this.control.pointer.locked && this.state.active) {
      this.state.active = false
      this.broadcast()
    }
    if (!this.control.pointer.locked && !this.state.active) {
      this.state.active = true
      this.broadcast()
    }
  }

  togglePane(pane) {
    if (pane === null || this.state.pane === pane) {
      this.state.pane = null
    } else {
      // if (appPanes.includes(this.state.pane) && !appPanes.includes(pane)) {
      //   this.state.app = null
      // }
      this.state.pane = pane
      if (appPanes.includes(pane)) {
        this.lastAppPane = pane
      }
    }
    this.broadcast()
  }

  toggleMenu(type = 'main', options = {}) {
    if (this.state.menu?.type === type && !options.force) {
      this.setMenu(null)
      return
    }
    this.setMenu({ type, ...options })
  }

  setMenu(menu) {
    if (!menu) {
      if (!this.state.menu) return
      this.state.menu = null
      this.broadcast()
      return
    }
    const next = { ...menu }
    if (!next.type) {
      next.type = 'main'
    }
    this.state.menu = next
    this.state.visible = true
    if (next.type !== 'app') {
      this.state.app = null
    }
    this.broadcast()
  }

  toggleApps(value) {
    const next = isBoolean(value) ? value : !this.state.apps
    if (next && !this.state.apps) {
      const player = this.world.entities.player
      const canOpen = player?.isBuilder?.()
      if (!canOpen) {
        const message = this.getLocalizedString(
          'ui.apps.buildersOnly',
          'Apps pane is available to builders only.'
        )
        this.world.emit('toast', message)
        return
      }
    }
    if (this.state.apps === next) return
    this.state.apps = next
    if (next) {
      this.state.visible = true
      this.state.menu = null
    }
    this.broadcast()
  }

  toggleVisible(value) {
    value = isBoolean(value) ? value : !this.state.visible
    if (this.state.visible === value) return
    this.state.visible = value
    this.broadcast()
  }

  setApp(app) {
    this.state.app = app
    this.state.pane = app ? this.lastAppPane : null
    this.broadcast()
  }

  shouldAllowTabNavigation() {
    return !!(this.state.menu || this.state.apps)
  }

  suppressReticle() {
    this.state.reticleSuppressors++
    let released
    this.broadcast()
    return () => {
      if (released) return
      this.state.reticleSuppressors--
      this.broadcast()
      released = true
    }
  }

  confirm(options) {
    const promise = new Promise(resolve => {
      options.confirm = () => {
        this.world.emit('confirm', null)
        resolve(true)
      }
      options.cancel = () => {
        this.world.emit('confirm', null)
        resolve(false)
      }
    })
    this.world.emit('confirm', options)
    return promise
  }

  broadcast() {
    this.world.emit('ui', { ...this.state })
  }

  destroy() {
    this.control?.release()
    this.control = null
  }
}
