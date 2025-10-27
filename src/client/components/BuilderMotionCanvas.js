import { css } from '@firebolt-dev/css'
import { useEffect, useRef } from 'react'

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;

void main() {
  vec2 st = gl_FragCoord.xy / u_resolution.xy;
  float wave = sin((st.x + u_time * 0.2) * 6.2831) * 0.08;
  float ripple = sin((st.y + u_time * 0.35) * 6.2831) * 0.04;
  float blend = smoothstep(0.0, 1.0, st.y + wave + ripple);
  vec3 base = vec3(0.08, 0.12, 0.22);
  vec3 accent = vec3(0.21, 0.17, 0.45);
  vec3 color = mix(base, accent, blend);
  float vignette = smoothstep(0.0, 0.45, st.y) * smoothstep(0.0, 0.8, 1.0 - st.y);
  gl_FragColor = vec4(color * (0.6 + 0.4 * vignette), 0.38);
}
`

export function BuilderMotionCanvas({ active }) {
  const canvasRef = useRef(null)
  const frameRef = useRef(null)
  const programRef = useRef(null)
  const glRef = useRef(null)
  const startRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { antialias: false, alpha: true })
    if (!gl) {
      return
    }
    glRef.current = gl
    const program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER)
    programRef.current = program
    const positionLocation = gl.getAttribLocation(program, 'a_position')
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    const resize = () => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        gl.viewport(0, 0, width, height)
      }
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const render = time => {
      if (!active) return
      if (!startRef.current) startRef.current = time
      const elapsed = (time - startRef.current) / 1000
      gl.useProgram(program)
      gl.uniform1f(gl.getUniformLocation(program, 'u_time'), elapsed)
      gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvas.width, canvas.height)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      frameRef.current = requestAnimationFrame(render)
    }
    if (active) {
      startRef.current = 0
      frameRef.current = requestAnimationFrame(render)
    }
    return () => {
      cancelAnimationFrame(frameRef.current)
      observer.disconnect()
      if (program) gl.deleteProgram(program)
      if (buffer) gl.deleteBuffer(buffer)
      startRef.current = 0
    }
  }, [active])

  return (
    <canvas
      ref={canvasRef}
      css={css`
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: ${active ? 1 : 0};
        transition: opacity var(--hf-motion-duration-medium) var(--hf-motion-ease-standard);
        mix-blend-mode: screen;
      `}
    />
  )
}

function createProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  const program = gl.createProgram()
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('Unable to initialize shader program:', gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    return null
  }
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)
  return program
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('Shader compile error:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}
