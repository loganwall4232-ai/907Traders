import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const PARTICLE_COUNT = 90
const MAX_CONNECTIONS = PARTICLE_COUNT * PARTICLE_COUNT
const CONNECTION_DIST = 130

export default function HeroCanvas({ accent = '#00e5ff' }) {
  const mountRef = useRef()

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let w = mount.clientWidth
    let h = mount.clientHeight
    let mouseX = 0
    let mouseY = 0
    let raf

    // ── Renderer ─────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    // ── Scene / Camera ────────────────────────────────
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(55, w / h, 1, 2000)
    camera.position.z = 380

    // ── Particles ─────────────────────────────────────
    const accentHex = parseInt(accent.replace('#', '0x'))
    const particles = []
    const posArr = new Float32Array(PARTICLE_COUNT * 3)
    const colArr = new Float32Array(PARTICLE_COUNT * 3)
    const color = new THREE.Color(accent)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = {
        x: (Math.random() - 0.5) * w * 1.4,
        y: (Math.random() - 0.5) * h * 1.4,
        z: (Math.random() - 0.5) * 160,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        vz: (Math.random() - 0.5) * 0.04,
        size: 0.4 + Math.random() * 2.2,
      }
      particles.push(p)
      posArr[i * 3]     = p.x
      posArr[i * 3 + 1] = p.y
      posArr[i * 3 + 2] = p.z
      colArr[i * 3]     = color.r
      colArr[i * 3 + 1] = color.g
      colArr[i * 3 + 2] = color.b
    }

    const pointGeo = new THREE.BufferGeometry()
    pointGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    pointGeo.setAttribute('color',    new THREE.BufferAttribute(colArr, 3))

    const pointMat = new THREE.PointsMaterial({
      size: 2.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
    })

    const pointMesh = new THREE.Points(pointGeo, pointMat)
    scene.add(pointMesh)

    // ── Lines ─────────────────────────────────────────
    const linePosArr = new Float32Array(MAX_CONNECTIONS * 2 * 3)
    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePosArr, 3))

    const lineMat = new THREE.LineBasicMaterial({
      color: accentHex,
      transparent: true,
      opacity: 0.13,
    })

    const linesMesh = new THREE.LineSegments(lineGeo, lineMat)
    scene.add(linesMesh)

    // ── Animation loop ─────────────────────────────────
    const animate = () => {
      raf = requestAnimationFrame(animate)

      let lineIdx = 0

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i]

        // nudge toward mouse
        p.vx += (mouseX - p.x) * 0.000015
        p.vy += (mouseY - p.y) * 0.000015

        // damping
        p.vx *= 0.998
        p.vy *= 0.998

        p.x += p.vx
        p.y += p.vy
        p.z += p.vz

        // soft wrap
        if (p.x > w * 0.8)  p.vx -= 0.08
        if (p.x < -w * 0.8) p.vx += 0.08
        if (p.y > h * 0.8)  p.vy -= 0.08
        if (p.y < -h * 0.8) p.vy += 0.08

        posArr[i * 3]     = p.x
        posArr[i * 3 + 1] = p.y
        posArr[i * 3 + 2] = p.z

        // connections
        for (let j = i + 1; j < PARTICLE_COUNT; j++) {
          const q = particles[j]
          const dx = p.x - q.x
          const dy = p.y - q.y
          const distSq = dx * dx + dy * dy
          if (distSq < CONNECTION_DIST * CONNECTION_DIST) {
            linePosArr[lineIdx++] = p.x
            linePosArr[lineIdx++] = p.y
            linePosArr[lineIdx++] = p.z
            linePosArr[lineIdx++] = q.x
            linePosArr[lineIdx++] = q.y
            linePosArr[lineIdx++] = q.z
          }
        }
      }

      pointGeo.attributes.position.needsUpdate = true
      lineGeo.attributes.position.needsUpdate = true
      lineGeo.setDrawRange(0, lineIdx / 3)

      // subtle camera drift
      camera.position.x += (mouseX * 0.018 - camera.position.x) * 0.025
      camera.position.y += (mouseY * 0.018 - camera.position.y) * 0.025
      camera.lookAt(scene.position)

      renderer.render(scene, camera)
    }
    animate()

    // ── Events ────────────────────────────────────────
    const onMouse = (e) => {
      mouseX = (e.clientX / w - 0.5) * w
      mouseY = -(e.clientY / h - 0.5) * h
    }

    const onResize = () => {
      w = mount.clientWidth
      h = mount.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }

    window.addEventListener('mousemove', onMouse)
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMouse)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      pointGeo.dispose()
      lineGeo.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [accent])

  return (
    <div
      ref={mountRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}
      aria-hidden="true"
    />
  )
}
