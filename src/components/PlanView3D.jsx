import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { loadScene3D } from '../lib/scene3dLoader'

const SVG_W = 2560
const SVG_H = 1567
const SCALE = 1 / 200

// Transform SVG → 3D :
//   shape (sx, sy) → after mesh.rotation.x = -π/2 → world (sx, extruded, -sy)
//   On négatif sy pour que SVG top (y=0) → world Z=-3.9 (loin = haut écran caméra sud)
//   et SVG bottom (y=1567) → world Z=+3.9 (près caméra = bas écran)
function svgToShape(x, y) {
  return [(x - SVG_W / 2) * SCALE, -(y - SVG_H / 2) * SCALE]
}

function svgCentroid(points) {
  const n = points.length
  const avgX = points.reduce((s, p) => s + p.x, 0) / n
  const avgY = points.reduce((s, p) => s + p.y, 0) / n
  return {
    x: (avgX - SVG_W / 2) * SCALE,
    z: (avgY - SVG_H / 2) * SCALE,  // world Z = -shapeY = (svgY - H/2)*SCALE
  }
}

const TYPE_BASE = { tonte: 0x4ade80, piscine: 0x60a5fa, haies: 0xfb923c }
const ALERT_COLOR = { warning: 0xfbbf24, alert: 0xef4444 }
const ALERT_HEIGHT = { ok: 0.06, warning: 0.40, alert: 0.85 }
const TYPE_ICON = { tonte: '🌿', piscine: '🏊', haies: '🌳' }

const LEGEND = [
  { color: '#4ade80', label: 'Tonte' },
  { color: '#60a5fa', label: 'Piscine' },
  { color: '#fb923c', label: 'Haies' },
  { color: '#fbbf24', label: 'Warning' },
  { color: '#ef4444', label: 'Alerte' },
]

export default function PlanView3D({ zones, onNavigate, onClose }) {
  const mountRef = useRef(null)
  const controlsRef = useRef(null)
  const cameraRef = useRef(null)
  const onNavigateRef = useRef(onNavigate)
  const onCloseRef = useRef(onClose)
  onNavigateRef.current = onNavigate
  onCloseRef.current = onClose

  function resetCamera() {
    const cam = cameraRef.current
    const ctrl = controlsRef.current
    if (!cam || !ctrl) return
    cam.position.set(0, 9, 8)
    cam.lookAt(0, 0, 0)
    ctrl.target.set(0, 0, 0)
    ctrl.update()
  }

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const w = mount.clientWidth
    const h = mount.clientHeight

    // ── Scene ──────────────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x111827)

    // ── Camera ─────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 100)
    camera.position.set(0, 9, 8)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // ── Renderer ───────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    // ── Label renderer ─────────────────────────────────────────
    const labelRenderer = new CSS2DRenderer()
    labelRenderer.setSize(w, h)
    Object.assign(labelRenderer.domElement.style, {
      position: 'absolute', top: '0', left: '0', pointerEvents: 'none',
    })
    mount.appendChild(labelRenderer.domElement)

    // ── OrbitControls ──────────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.maxPolarAngle = Math.PI / 2.05
    controls.minDistance = 2
    controls.maxDistance = 22
    controlsRef.current = controls

    // ── Lights ─────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.7))
    const sun = new THREE.DirectionalLight(0xffffff, 0.85)
    sun.position.set(6, 12, 8)
    scene.add(sun)

    // ── Floor — plan_fond.png comme texture ────────────────────
    // MeshBasicMaterial = pas d'éclairage sur l'image cartographique (affichée telle quelle)
    // flipY=true (Three.js default) : image bas → UV v=0 → world +Z (sud, bas écran) ✓
    const floorMat = new THREE.MeshBasicMaterial({ color: 0xd4e8c2 })
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(SVG_W * SCALE, SVG_H * SCALE),
      floorMat
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = 0
    scene.add(floor)

    const loader = new THREE.TextureLoader()
    loader.load(
      import.meta.env.BASE_URL + 'plan_fond.png',
      (tex) => {
        floorMat.map = tex
        floorMat.color.set(0xffffff)
        floorMat.needsUpdate = true
      }
    )

    // ── Zones ──────────────────────────────────────────────────
    const zoneMeshes = []

    zones.forEach(zone => {
      const points = zone.config?.points
      if (!points?.length) return

      const level  = zone.alert?.level ?? 'ok'
      const height = ALERT_HEIGHT[level] ?? ALERT_HEIGHT.ok
      const color  = ALERT_COLOR[level] ?? TYPE_BASE[zone.type] ?? 0x9ca3af

      const shape = new THREE.Shape(
        points.map(({ x, y }) => new THREE.Vector2(...svgToShape(x, y)))
      )
      const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false })
      const mat = new THREE.MeshStandardMaterial({
        color, roughness: 0.55, metalness: 0.04,
        transparent: true, opacity: 0.85,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.rotation.x = -Math.PI / 2
      mesh.position.y = 0.01
      scene.add(mesh)
      zoneMeshes.push({ mesh, zone })

      // Label
      const c = svgCentroid(points)
      const div = document.createElement('div')
      Object.assign(div.style, {
        background: 'rgba(0,0,0,0.72)', color: 'white',
        padding: '2px 7px', borderRadius: '4px',
        fontSize: '11px', fontFamily: 'sans-serif', whiteSpace: 'nowrap',
      })
      div.textContent = `${TYPE_ICON[zone.type] ?? ''} ${zone.name}`
      const lbl = new CSS2DObject(div)
      lbl.position.set(c.x, 0.01 + height + 0.2, c.z)
      scene.add(lbl)
    })

    // ── Éléments spatiaux 3D (haies / arbres / routes depuis admin) ────────
    let scene3dCleanup = null
    let mounted = true
    loadScene3D(scene, import.meta.env.BASE_URL).then(cleanup => {
      if (mounted) scene3dCleanup = cleanup
      else cleanup?.()
    })

    // ── Click → navigate (tap detection with drag guard) ───────
    let downPos = null

    function onPointerDown(e) {
      downPos = { x: e.clientX, y: e.clientY }
    }

    function onPointerUp(e) {
      if (!downPos) return
      const dx = e.clientX - downPos.x
      const dy = e.clientY - downPos.y
      downPos = null
      if (Math.sqrt(dx * dx + dy * dy) > 8) return  // drag, not tap

      const rect = renderer.domElement.getBoundingClientRect()
      const ptr = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      )
      const ray = new THREE.Raycaster()
      ray.setFromCamera(ptr, camera)
      const hits = ray.intersectObjects(zoneMeshes.map(z => z.mesh))
      if (!hits.length) return
      const hit = zoneMeshes.find(z => z.mesh === hits[0].object)
      if (hit) {
        onCloseRef.current()
        onNavigateRef.current(hit.zone.type, hit.zone)
      }
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)

    // ── Animate ────────────────────────────────────────────────
    let frameId
    function animate() {
      frameId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
      labelRenderer.render(scene, camera)
    }
    animate()

    // ── Resize ─────────────────────────────────────────────────
    function onResize() {
      const nw = mount.clientWidth
      const nh = mount.clientHeight
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
      renderer.setSize(nw, nh)
      labelRenderer.setSize(nw, nh)
    }
    window.addEventListener('resize', onResize)

    return () => {
      mounted = false
      scene3dCleanup?.()
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      controls.dispose()
      zoneMeshes.forEach(({ mesh }) => {
        mesh.geometry.dispose()
        mesh.material.dispose()
      })
      floor.geometry.dispose()
      floor.material.dispose()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
      if (mount.contains(labelRenderer.domElement)) mount.removeChild(labelRenderer.domElement)
    }
  }, [zones])  // onNavigate/onClose via refs — pas de dépendance pour éviter recréation scène

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#111827', display: 'flex', flexDirection: 'column' }}>

      {/* Header bar */}
      <div style={{
        position: 'absolute', top: 12, left: 0, right: 0, zIndex: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 16px', pointerEvents: 'none',
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.65)', borderRadius: 8, padding: '6px 12px',
          color: 'white', fontSize: 13, fontWeight: 600,
        }}>
          Vue 3D — Plan camping
        </div>
        <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto' }}>
          <button
            onClick={resetCamera}
            style={{
              background: 'rgba(0,0,0,0.72)', border: 'none', color: 'white',
              borderRadius: 8, padding: '0 12px', height: 38, fontSize: 12,
              cursor: 'pointer', fontWeight: 600,
            }}
          >
            ⊙ Vue initiale
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(0,0,0,0.72)', border: 'none', color: 'white',
              borderRadius: '50%', width: 38, height: 38, fontSize: 20,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.65)', borderRadius: 8, padding: '7px 14px',
        display: 'flex', gap: 14, zIndex: 10, pointerEvents: 'none', flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        {LEGEND.map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
            <span style={{ color: 'white', fontSize: 11 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Three.js mount */}
      <div ref={mountRef} style={{ flex: 1, position: 'relative' }} />
    </div>
  )
}
