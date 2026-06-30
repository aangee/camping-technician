import * as THREE from 'three'

// Converts admin-baked world coords (180x150m scale) → app-technician world units (SCALE=1/200)
// baked_x = (svgX - 1280) * (180/2560)  →  atX = (svgX - 1280) / 200  →  atX = baked_x / 14.0625
// baked_z = -(svgY - 783.5) * (150/1567) →  atZ = (svgY-783.5)/200 = -baked_z/19.144
function toAtX(bx) { return bx / 14.0625 }
function toAtZ(bz) { return -bz / 19.144 }
function toAtH(bh) { return bh / 14.0625 }

const TREE_COLORS = { pin: 0x15803d, cerisier: 0xf43f5e, feuillu: 0x65a30d }

function makeTreeGeom(subtype) {
  if (subtype === 'pin')      return new THREE.ConeGeometry(0.04, 0.18, 6)
  if (subtype === 'cerisier') return new THREE.SphereGeometry(0.05, 8, 6)
  return new THREE.DodecahedronGeometry(0.045)
}

export async function loadScene3D(scene, baseUrl) {
  let data
  try {
    const res = await fetch(baseUrl + 'scene3d.json')
    if (!res.ok) return null
    data = await res.json()
  } catch { return null }
  if (!data?.elements?.length) return null

  const group    = new THREE.Group()
  group.name     = 'scene3d'
  const toDispose = []

  // ── Arbres (InstancedMesh par subtype) ────────────────────────────────
  const byType = {}
  data.elements.filter(el => el.type === 'point')
    .forEach(el => { (byType[el.subtype] ??= []).push(el) })

  for (const [subtype, list] of Object.entries(byType)) {
    const geom  = makeTreeGeom(subtype)
    const mat   = new THREE.MeshStandardMaterial({ color: TREE_COLORS[subtype] ?? 0x65a30d })
    const imesh = new THREE.InstancedMesh(geom, mat, list.length)
    const dummy = new THREE.Object3D()
    list.forEach((el, i) => {
      const x    = toAtX(el.position.x)
      const z    = toAtZ(el.position.z)
      const yOff = subtype === 'pin' ? 0.09 : 0.05
      dummy.position.set(x, yOff * (el.scale ?? 1), z)
      dummy.scale.setScalar(el.scale ?? 1)
      dummy.updateMatrix()
      imesh.setMatrixAt(i, dummy.matrix)
    })
    imesh.instanceMatrix.needsUpdate = true
    group.add(imesh)
    toDispose.push(geom, mat)
  }

  // ── Haies (linear_extrude → segments BoxGeometry) ────────────────────
  data.elements.filter(el => el.type === 'linear_extrude').forEach(el => {
    const pts = el.points.map(p => ({ x: toAtX(p.x), z: toAtZ(p.z) }))
    const h   = toAtH(el.height ?? 2.5)
    const w   = toAtH(el.width  ?? 0.6)
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1]
      const dx = b.x - a.x, dz = b.z - a.z
      const len = Math.sqrt(dx * dx + dz * dz)
      if (len < 0.001) continue
      const geom = new THREE.BoxGeometry(len, h, w)
      const mat  = new THREE.MeshStandardMaterial({ color: 0x4ade80, opacity: 0.85, transparent: true })
      const box  = new THREE.Mesh(geom, mat)
      box.position.set((a.x + b.x) / 2, h / 2, (a.z + b.z) / 2)
      box.rotation.y = Math.atan2(-dz, dx)
      group.add(box)
      toDispose.push(geom, mat)
    }
  })

  // ── Routes (polyline → segments plats BoxGeometry) ───────────────────
  data.elements.filter(el => el.type === 'polyline').forEach(el => {
    const pts = el.points.map(p => ({ x: toAtX(p.x), z: toAtZ(p.z) }))
    const w   = (el.width ?? 4) / 200  // SVG px → app-tech units (scale 1/200)
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1]
      const dx = b.x - a.x, dz = b.z - a.z
      const len = Math.sqrt(dx * dx + dz * dz)
      if (len < 0.001) continue
      const geom = new THREE.BoxGeometry(len, 0.004, w)
      const mat  = new THREE.MeshStandardMaterial({ color: 0xd97706, opacity: 0.8, transparent: true })
      const box  = new THREE.Mesh(geom, mat)
      box.position.set((a.x + b.x) / 2, 0.003, (a.z + b.z) / 2)
      box.rotation.y = Math.atan2(-dz, dx)
      group.add(box)
      toDispose.push(geom, mat)
    }
  })

  // polygon_extrude (piscine) intentionnellement skippé :
  // déjà rendu par les zones Supabase dans PlanView3D (même données, évite doublon)

  if (!group.children.length) return null
  scene.add(group)

  return () => {
    scene.remove(group)
    toDispose.forEach(d => d.dispose())
  }
}
