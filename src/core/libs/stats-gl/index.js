import Panel from './panel'
import { STATS_PALETTE_DEFAULT, STATS_PALETTE_HIGH_CONTRAST } from '../constants/statsPalettes.js'

const DEFAULT_TELEMETRY_PALETTES = {
  [STATS_PALETTE_DEFAULT]: {
    fps: { fg: '#0ff', bg: '#002' },
    cpu: { fg: '#0f0', bg: '#020' },
    gpuWebGL: { fg: '#ff0', bg: '#220' },
    gpuWebGPU: { fg: '#5ac8ff', bg: '#0c223a' },
    gpuComputeWebGPU: { fg: '#d7a8ff', bg: '#26113b' },
    ping: { fg: '#f00', bg: '#200' },
  },
  [STATS_PALETTE_HIGH_CONTRAST]: {
    fps: { fg: '#00f5ff', bg: '#001219' },
    cpu: { fg: '#61ff4d', bg: '#01260f' },
    gpuWebGL: { fg: '#fff454', bg: '#261f02' },
    gpuWebGPU: { fg: '#74a6ff', bg: '#001a33' },
    gpuComputeWebGPU: { fg: '#ff7dd8', bg: '#2d0023' },
    ping: { fg: '#ff6b6b', bg: '#2b0000' },
  },
}

const DEFAULT_TELEMETRY_PALETTE = DEFAULT_TELEMETRY_PALETTES[STATS_PALETTE_DEFAULT]

/**
 * This is a modified version of stats-gl
 *
 * See: https://github.com/RenaudRohlinger/stats-gl/issues/10
 *
 * 1. Commented out patchThreeRenderer so we can use begin/end/update manually at engine level
 */

class Stats {
  totalCpuDuration = 0
  totalGpuDuration = 0
  totalGpuDurationCompute = 0
  totalFps = 0
  mode
  info
  dom
  minimal
  horizontal
  beginTime
  prevTime
  prevCpuTime
  frames
  averageCpu
  averageGpu
  averageGpuCompute
  queryCreated
  isRunningCPUProfiling
  fpsPanel
  // static Panel
  msPanel
  gpuPanel
  gpuPanelCompute
  samplesLog
  samplesGraph
  logsPerSecond
  activeQuery = null

  precision
  gl
  ext
  query
  disjoint
  ns
  threeRendererPatched
  gpuQueries = []
  renderCount = 0

  constructor({
    logsPerSecond = 20,
    samplesLog = 100,
    samplesGraph = 10,
    precision = 2,
    minimal = false,
    horizontal = true,
    mode = 0,
    telemetryPalette = STATS_PALETTE_DEFAULT,
    telemetryPalettes,
  } = {}) {
    this.mode = mode
    this.horizontal = horizontal
    this.dom = document.createElement('div')
    this.dom.style.cssText = 'position:absolute;top:0;right:0;opacity:0.9;z-index:1;display:flex;align-items:center;'

    if (minimal) {
      this.dom.style.cssText += 'cursor:pointer'
    }

    this.gl = null
    this.query = null

    this.isRunningCPUProfiling = false
    this.minimal = minimal

    this.beginTime = (performance || Date).now()
    this.prevTime = this.beginTime
    this.prevCpuTime = this.beginTime
    this.frames = 0
    this.renderCount = 0
    this.threeRendererPatched = false
    this.rendererBackend = 'webgl'
    this.averageCpu = {
      logs: [],
      graph: [],
    }
    this.averageGpu = {
      logs: [],
      graph: [],
    }
    this.averageGpuCompute = {
      logs: [],
      graph: [],
    }

    this.queryCreated = false

    this.telemetryPalettes = {
      ...DEFAULT_TELEMETRY_PALETTES,
      ...(telemetryPalettes || {}),
    }
    this.telemetryPaletteName = this.telemetryPalettes[telemetryPalette]
      ? telemetryPalette
      : STATS_PALETTE_DEFAULT

    const fpsColors = this.getTelemetryPanelColors('fps')
    this.fpsPanel = this.addPanel(new Panel('FPS', fpsColors.fg, fpsColors.bg), 0)
    const cpuColors = this.getTelemetryPanelColors('cpu')
    this.msPanel = this.addPanel(new Panel('CPU', cpuColors.fg, cpuColors.bg), 1)
    this.gpuPanel = null
    this.gpuPanelCompute = null

    this.samplesLog = samplesLog
    this.samplesGraph = samplesGraph
    this.precision = precision
    this.logsPerSecond = logsPerSecond

    if (this.minimal) {
      this.dom.addEventListener(
        'click',
        event => {
          event.preventDefault()
          this.showPanel(++this.mode % this.dom.children.length)
        },
        false
      )

      this.mode = mode
      this.showPanel(this.mode)
    } else {
      window.addEventListener('resize', () => {
        this.resizePanel(this.fpsPanel, 0)
        this.resizePanel(this.msPanel, 1)

        if (this.gpuPanel) {
          this.resizePanel(this.gpuPanel, 2)
        }
        if (this.gpuPanelCompute) {
          this.resizePanel(this.gpuPanelCompute, 3)
        }
      })
    }
  }

  patchThreeRenderer(renderer) {
    // Store the original render method
    const originalRenderMethod = renderer.render

    // Reference to the stats instance
    const statsInstance = this

    // Override the render method on the prototype
    renderer.render = function (scene, camera) {
      statsInstance.begin() // Start tracking for this render call

      // Call the original render method
      originalRenderMethod.call(this, scene, camera)

      statsInstance.end() // End tracking for this render call
    }

    this.threeRendererPatched = true
  }

  resizePanel(panel, offset) {
    // panel.canvas.style.position = 'absolute'

    if (this.minimal) {
      panel.canvas.style.display = 'none'
    } else {
      panel.canvas.style.display = 'block'
      if (this.horizontal) {
        panel.canvas.style.top = '0px'
        panel.canvas.style.left = (offset * panel.WIDTH) / panel.PR + 'px'
      } else {
        panel.canvas.style.left = '0px'
        panel.canvas.style.top = (offset * panel.HEIGHT) / panel.PR + 'px'
      }
    }
  }

  addPanel(panel, offset) {
    if (panel.canvas) {
      this.dom.appendChild(panel.canvas)

      this.resizePanel(panel, offset)
    }

    return panel
  }

  getTelemetryPanelColors(type, { palette, renderer } = {}) {
    const paletteName =
      palette && this.telemetryPalettes[palette] ? palette : this.telemetryPaletteName
    const paletteDefinition =
      this.telemetryPalettes[paletteName] || DEFAULT_TELEMETRY_PALETTE
    const backend = renderer || this.rendererBackend

    if (type === 'fps' && paletteDefinition.fps) return paletteDefinition.fps
    if (type === 'cpu' && paletteDefinition.cpu) return paletteDefinition.cpu
    if (type === 'ping' && paletteDefinition.ping) return paletteDefinition.ping

    if (type === 'gpu') {
      if (backend === 'webgpu' && paletteDefinition.gpuWebGPU) {
        return paletteDefinition.gpuWebGPU
      }
      return paletteDefinition.gpuWebGL || DEFAULT_TELEMETRY_PALETTE.gpuWebGL
    }

    if (type === 'gpu-compute') {
      if (backend === 'webgpu' && paletteDefinition.gpuComputeWebGPU) {
        return paletteDefinition.gpuComputeWebGPU
      }
      return paletteDefinition.gpuWebGL || DEFAULT_TELEMETRY_PALETTE.gpuWebGL
    }

    return DEFAULT_TELEMETRY_PALETTE.fps
  }

  applyTelemetryPalette() {
    const fpsColors = this.getTelemetryPanelColors('fps')
    this.fpsPanel?.setColors(fpsColors.fg, fpsColors.bg)

    const cpuColors = this.getTelemetryPanelColors('cpu')
    this.msPanel?.setColors(cpuColors.fg, cpuColors.bg)

    if (this.gpuPanel) {
      const gpuColors = this.getTelemetryPanelColors('gpu')
      this.gpuPanel.setColors(gpuColors.fg, gpuColors.bg)
    }

    if (this.gpuPanelCompute) {
      const computeColors = this.getTelemetryPanelColors('gpu-compute')
      this.gpuPanelCompute.setColors(computeColors.fg, computeColors.bg)
    }
  }

  setTelemetryPalette(name) {
    if (!this.telemetryPalettes[name]) return
    if (this.telemetryPaletteName === name) return
    this.telemetryPaletteName = name
    this.applyTelemetryPalette()
  }

  showPanel(id) {
    for (let i = 0; i < this.dom.children.length; i++) {
      const child = this.dom.children[i]

      child.style.display = i === id ? 'block' : 'none'
    }

    this.mode = id
  }

  async init(canvasOrGL, patch = true) {
    if (!canvasOrGL) {
      console.error('Stats: The "canvas" parameter is undefined.')
      return
    }

    if (canvasOrGL.isWebGLRenderer && !this.threeRendererPatched) {
      const canvas = canvasOrGL
      if (patch) {
        this.patchThreeRenderer(canvas)
      }
      this.gl = canvas.getContext()
      this.rendererBackend = 'webgl'
    } else if (!this.gl && canvasOrGL instanceof WebGL2RenderingContext) {
      this.gl = canvasOrGL
      this.rendererBackend = 'webgl'
    }

    if (canvasOrGL.isWebGPURenderer) {
      this.rendererBackend = 'webgpu'
      canvasOrGL.backend.trackTimestamp = true

      if (await canvasOrGL.hasFeatureAsync('timestamp-query')) {
        const gpuColors = this.getTelemetryPanelColors('gpu', { renderer: 'webgpu' })
        this.gpuPanel = this.addPanel(new Panel('GPU', gpuColors.fg, gpuColors.bg), 2)
        const computeColors = this.getTelemetryPanelColors('gpu-compute', { renderer: 'webgpu' })
        this.gpuPanelCompute = this.addPanel(new Panel('CPT', computeColors.fg, computeColors.bg), 3)
        this.info = canvasOrGL.info
      }
      return
    }
    // Check if canvasOrGL is already a WebGL2RenderingContext

    // Handle HTMLCanvasElement and OffscreenCanvas
    else if ((!this.gl && canvasOrGL instanceof HTMLCanvasElement) || canvasOrGL instanceof OffscreenCanvas) {
      this.gl = canvasOrGL.getContext('webgl2')
      if (!this.gl) {
        console.error('Stats: Unable to obtain WebGL2 context.')
        return
      }
    } else if (!this.gl) {
      console.error(
        'Stats: Invalid input type. Expected WebGL2RenderingContext, HTMLCanvasElement, or OffscreenCanvas.'
      )
      return
    }

    // Get the extension
    this.ext = this.gl.getExtension('EXT_disjoint_timer_query_webgl2')
    if (this.ext) {
      const gpuColors = this.getTelemetryPanelColors('gpu', { renderer: 'webgl' })
      this.gpuPanel = this.addPanel(new Panel('GPU', gpuColors.fg, gpuColors.bg), 2)
    }
  }

  begin() {
    if (!this.isRunningCPUProfiling) {
      this.beginProfiling('cpu-started')
    }

    if (!this.gl || !this.ext) return

    if (this.gl && this.ext) {
      if (this.activeQuery) {
        // End the previous query if it's still active
        this.gl.endQuery(this.ext.TIME_ELAPSED_EXT)
      }

      this.activeQuery = this.gl.createQuery()
      if (this.activeQuery !== null) {
        this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, this.activeQuery)
      }
    }
  }

  end() {
    // Increase render count
    this.renderCount++

    if (this.gl && this.ext && this.activeQuery) {
      this.gl.endQuery(this.ext.TIME_ELAPSED_EXT)
      // Add the active query to the gpuQueries array and reset it
      this.gpuQueries.push({ query: this.activeQuery })
      this.activeQuery = null
    }
  }

  processGpuQueries() {
    if (!this.gl || !this.ext) return

    this.totalGpuDuration = 0

    this.gpuQueries.forEach((queryInfo, index) => {
      if (this.gl) {
        const available = this.gl.getQueryParameter(queryInfo.query, this.gl.QUERY_RESULT_AVAILABLE)
        const disjoint = this.gl.getParameter(this.ext.GPU_DISJOINT_EXT)

        if (available && !disjoint) {
          const elapsed = this.gl.getQueryParameter(queryInfo.query, this.gl.QUERY_RESULT)
          const duration = elapsed * 1e-6 // Convert nanoseconds to milliseconds
          this.totalGpuDuration += duration
          this.gl.deleteQuery(queryInfo.query)
          this.gpuQueries.splice(index, 1) // Remove the processed query
        }
      }
    })
  }

  update() {
    if (this.info === undefined) {
      this.processGpuQueries()
    } else {
      this.totalGpuDuration = this.info.render.timestamp
      this.totalGpuDurationCompute = this.info.compute.timestamp
      this.addToAverage(this.totalGpuDurationCompute, this.averageGpuCompute)
    }

    this.endProfiling('cpu-started', 'cpu-finished', 'cpu-duration')

    // Calculate the total duration of CPU and GPU work for this frame
    this.addToAverage(this.totalCpuDuration, this.averageCpu)
    this.addToAverage(this.totalGpuDuration, this.averageGpu)

    this.renderCount = 0

    // If this.totalCpuDuration is 0, it means that the CPU query was not created and stats.begin() never called/overrided
    if (this.totalCpuDuration === 0) {
      this.beginProfiling('cpu-started')
    }

    this.totalCpuDuration = 0

    this.totalFps = 0

    this.beginTime = this.endInternal()
  }

  endInternal() {
    this.frames++
    const time = (performance || Date).now()

    if (time >= this.prevCpuTime + 1000 / this.logsPerSecond) {
      this.updatePanel(this.msPanel, this.averageCpu)
      this.updatePanel(this.gpuPanel, this.averageGpu)

      if (this.gpuPanelCompute) {
        this.updatePanel(this.gpuPanelCompute, this.averageGpuCompute)
      }

      this.prevCpuTime = time
    }

    if (time >= this.prevTime + 1000) {
      const fps = (this.frames * 1000) / (time - this.prevTime)

      this.fpsPanel.update(fps, fps, 100, 100, 0)

      this.prevTime = time
      this.frames = 0
    }

    return time
  }

  addToAverage(value, averageArray) {
    averageArray.logs.push(value)
    if (averageArray.logs.length > this.samplesLog) {
      averageArray.logs.shift()
    }

    averageArray.graph.push(value)
    if (averageArray.graph.length > this.samplesGraph) {
      averageArray.graph.shift()
    }
  }

  beginProfiling(marker) {
    if (window.performance) {
      window.performance.mark(marker)
      this.isRunningCPUProfiling = true
    }
  }

  endProfiling(startMarker, endMarker, measureName) {
    if (window.performance && endMarker && this.isRunningCPUProfiling) {
      window.performance.mark(endMarker)
      const cpuMeasure = performance.measure(measureName, startMarker, endMarker)
      this.totalCpuDuration += cpuMeasure.duration
      this.isRunningCPUProfiling = false
    }
  }

  updatePanel(panel, averageArray) {
    if (averageArray.logs.length > 0) {
      let sumLog = 0
      let max = 0.01

      for (let i = 0; i < averageArray.logs.length; i++) {
        sumLog += averageArray.logs[i]

        if (averageArray.logs[i] > max) {
          max = averageArray.logs[i]
        }
      }

      let sumGraph = 0
      let maxGraph = 0.01
      for (let i = 0; i < averageArray.graph.length; i++) {
        sumGraph += averageArray.graph[i]

        if (averageArray.graph[i] > maxGraph) {
          maxGraph = averageArray.graph[i]
        }
      }

      if (panel) {
        panel.update(
          sumLog / Math.min(averageArray.logs.length, this.samplesLog),
          sumGraph / Math.min(averageArray.graph.length, this.samplesGraph),
          max,
          maxGraph,
          this.precision
        )
      }
    }
  }

  get domElement() {
    // patch for some use case in threejs
    return this.dom
  }

  get container() {
    // @deprecated

    console.warn('Stats: Deprecated! this.container as been replaced to this.dom ')
    return this.dom
  }
}

export default Stats
