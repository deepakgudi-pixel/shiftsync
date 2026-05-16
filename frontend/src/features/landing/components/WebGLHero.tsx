'use client'
import { useEffect, useRef } from 'react'

export function WebGLHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    })
    if (!gl) return

    const vs = `
      attribute vec2 position;
      void main() { gl_Position = vec4(position, 0.0, 1.0); }
    `

    const fs = `
      precision highp float;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform float u_ratio;

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        vec2 p = uv * 4.0;
        p.x *= u_ratio;

        float t = u_time * 0.5;
        
        for(int i=1; i<5; i++){
          float fi = float(i);
          p.x += 0.4 / fi * sin(fi * p.y + t + 0.5 * fi);
          p.y += 0.4 / fi * sin(fi * p.x + t + 0.3 * fi);
        }

        float strength = sin(p.x + p.y);
        vec3 color = mix(vec3(0.05, 0.1, 0.2), vec3(0.2, 0.5, 1.0), strength * 0.5 + 0.5);
        
        float highlight = pow(max(0.0, strength), 12.0);
        color += highlight * 0.4;

        gl_FragColor = vec4(color * 0.8, 1.0);
      }
    `

    const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      return shader
    }

    const program = gl.createProgram()!
    gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vs))
    gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fs))
    gl.linkProgram(program)
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)

    const pos = gl.getAttribLocation(program, 'position')
    gl.enableVertexAttribArray(pos)
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)

    const utime = gl.getUniformLocation(program, 'u_time')
    const ures = gl.getUniformLocation(program, 'u_resolution')
    const uratio = gl.getUniformLocation(program, 'u_ratio')

    const handleResize = () => {
      const displayWidth = window.innerWidth
      const displayHeight = window.innerHeight
      const dpr = window.devicePixelRatio || 1
      const ratio = displayWidth / displayHeight

      if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
        canvas.width = displayWidth * dpr
        canvas.height = displayHeight * dpr
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.useProgram(program)
        gl.uniform2f(ures, canvas.width, canvas.height)
        gl.uniform1f(uratio, ratio)
      }
    }

    window.addEventListener('resize', handleResize)
    handleResize()

    const render = (time: number) => {
      if (!canvasRef.current || !gl) return
      gl.uniform1f(utime, time * 0.001)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      requestAnimationFrame(render)
    }

    let raf = requestAnimationFrame(render)

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(raf)
    }
  }, [])

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full opacity-60 pointer-events-none z-[-1]" />
}
