import * as THREE from 'three'
import { createNoise2D } from 'simplex-noise'
import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
} from 'three-mesh-bvh'

// Patch Three.js with BVH once at module load
;(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree
;(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree
THREE.Mesh.prototype.raycast = acceleratedRaycast

const TERRAIN_SIZE = 8000
const TERRAIN_SEGMENTS = 256
const FLAT_ZONE_RADIUS = 400

const COLOR_GRASS = new THREE.Color(0x4e8a5a)
const COLOR_DIRT  = new THREE.Color(0x8b7355)
const COLOR_ROCK  = new THREE.Color(0x7a7870)
const COLOR_CLIFF = new THREE.Color(0x5e5c58)
const COLOR_SNOW  = new THREE.Color(0xf0efed)

export let terrainMesh: THREE.Mesh

function sampleHeight(
  shape: ReturnType<typeof createNoise2D>,
  warp: ReturnType<typeof createNoise2D>,
  detail: ReturnType<typeof createNoise2D>,
  x: number,
  z: number
): number {
  // Domain warping breaks up grid regularity for more organic ridgelines
  const wx = warp(x / 900, z / 900) * 220
  const wz = warp(x / 900 + 4.3, z / 900 + 2.8) * 220

  return (
    shape((x + wx) / 1400, (z + wz) / 1400) * 320 + // large ridges
    shape(x / 500, z / 500) * 70 +                    // mid hills
    detail(x / 150, z / 150) * 18 +                   // small bumps
    detail(x / 45, z / 45) * 5                        // surface texture
  )
}

function heightColor(y: number, slopeAngle: number): THREE.Color {
  const out = new THREE.Color()

  if (slopeAngle > 0.55) return COLOR_CLIFF
  if (slopeAngle > 0.35) return out.lerpColors(COLOR_ROCK, COLOR_CLIFF, (slopeAngle - 0.35) / 0.20)

  if (y > 240) return COLOR_SNOW
  if (y > 190) return out.lerpColors(COLOR_ROCK, COLOR_SNOW, (y - 190) / 50)
  if (y > 120) return out.lerpColors(COLOR_DIRT, COLOR_ROCK, (y - 120) / 70)
  if (y > 40)  return out.lerpColors(COLOR_GRASS, COLOR_DIRT, (y - 40) / 80)
  return COLOR_GRASS
}

export function createTerrain(): THREE.Mesh {
  const shape  = createNoise2D()
  const warp   = createNoise2D()
  const detail = createNoise2D()

  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS)
  geo.rotateX(-Math.PI / 2)

  const pos = geo.attributes.position

  // Pass 1: displace vertices
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)

    const dist      = Math.sqrt(x * x + z * z)
    const flatBlend = Math.min(1, Math.max(0, (dist - FLAT_ZONE_RADIUS) / 600))

    pos.setY(i, sampleHeight(shape, warp, detail, x, z) * flatBlend)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()

  // Pass 2: assign vertex colors by height + slope
  const normals = geo.attributes.normal
  const colors  = new Float32Array(pos.count * 3)

  for (let i = 0; i < pos.count; i++) {
    const y          = pos.getY(i)
    const slopeAngle = 1 - Math.abs(normals.getY(i)) // 0=flat, 1=vertical
    const c = heightColor(y, slopeAngle)
    colors[i * 3]     = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  ;(geo as any).computeBoundsTree()

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
  })

  terrainMesh = new THREE.Mesh(geo, mat)
  terrainMesh.receiveShadow = true
  return terrainMesh
}
