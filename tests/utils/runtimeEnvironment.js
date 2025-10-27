let installed = false

export function installRuntimeEnvironment() {
  if (installed) return

  const noop = () => {}
  if (typeof globalThis.performance === 'undefined') {
    globalThis.performance = { now: () => Date.now() }
  }

  if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
      addEventListener: noop,
      removeEventListener: noop,
      dispatchEvent: noop,
      innerWidth: 1920,
      innerHeight: 1080,
      matchMedia: () => ({ matches: false, addListener: noop, removeListener: noop }),
      requestAnimationFrame: cb => setTimeout(() => cb(performance.now()), 16),
      cancelAnimationFrame: id => clearTimeout(id),
      navigator: undefined,
    }
  }

  if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
      addEventListener: noop,
      removeEventListener: noop,
      createElement: () => ({ style: {} }),
      createElementNS: () => ({ style: {} }),
      body: {
        addEventListener: noop,
        removeEventListener: noop,
        classList: { add: noop, remove: noop },
      },
    }
  }

  if (typeof globalThis.navigator === 'undefined') {
    globalThis.navigator = {
      platform: 'test',
      userAgent: 'hyperfy-tests',
      language: 'en-US',
    }
  }

  if (typeof globalThis.self === 'undefined') {
    globalThis.self = globalThis
  }

  if (typeof globalThis.requestAnimationFrame === 'undefined') {
    globalThis.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16)
  }

  if (typeof globalThis.cancelAnimationFrame === 'undefined') {
    globalThis.cancelAnimationFrame = id => clearTimeout(id)
  }

  if (!globalThis.HTMLCanvasElement) {
    globalThis.HTMLCanvasElement = function HTMLCanvasElement() {}
    globalThis.HTMLCanvasElement.prototype.getContext = noop
  }

  if (!globalThis.MutationObserver) {
    globalThis.MutationObserver = class {
      observe() {}
      disconnect() {}
      takeRecords() { return [] }
    }
  }

  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }

  if (!globalThis.matchMedia) {
    globalThis.matchMedia = () => ({ matches: false, addListener: noop, removeListener: noop })
  }

  if (!globalThis.localStorage) {
    const storage = new Map()
    globalThis.localStorage = {
      getItem: key => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key),
      clear: () => storage.clear(),
    }
  }

  if (!globalThis.sessionStorage) {
    const storage = new Map()
    globalThis.sessionStorage = {
      getItem: key => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key),
      clear: () => storage.clear(),
    }
  }

  if (!globalThis.WebSocket) {
    class StubWebSocket {
      constructor() {
        this.readyState = 1
        this.url = ''
        this.binaryType = 'arraybuffer'
        this.listeners = new Map()
      }
      addEventListener(type, listener) {
        const list = this.listeners.get(type) || []
        list.push(listener)
        this.listeners.set(type, list)
      }
      removeEventListener(type, listener) {
        const list = this.listeners.get(type)
        if (!list) return
        const idx = list.indexOf(listener)
        if (idx !== -1) list.splice(idx, 1)
      }
      send() {}
      close() {
        const list = this.listeners.get('close') || []
        for (const listener of list) {
          listener({ reason: 'stub-close' })
        }
      }
    }
    globalThis.WebSocket = StubWebSocket
  }

  if (!globalThis.fetch) {
    globalThis.fetch = async () => ({
      async arrayBuffer() { return new ArrayBuffer(0) },
      async text() { return '' },
      async json() { return {} },
      ok: true,
      status: 200,
    })
  }

  if (!globalThis.FormData) {
    globalThis.FormData = class {
      append() {}
    }
  }

  if (!globalThis.URL) {
    globalThis.URL = class URL {
      constructor(input) {
        this.href = String(input)
      }
    }
  }

  if (!globalThis.window.navigator) {
    globalThis.window.navigator = globalThis.navigator
  }

  if (!globalThis.window.requestAnimationFrame) {
    globalThis.window.requestAnimationFrame = globalThis.requestAnimationFrame
  }

  if (!globalThis.window.cancelAnimationFrame) {
    globalThis.window.cancelAnimationFrame = globalThis.cancelAnimationFrame
  }

  if (!globalThis.window.matchMedia) {
    globalThis.window.matchMedia = globalThis.matchMedia
  }

  if (!globalThis.window.localStorage) {
    globalThis.window.localStorage = globalThis.localStorage
  }

  if (!globalThis.window.sessionStorage) {
    globalThis.window.sessionStorage = globalThis.sessionStorage
  }

  installed = true
}
