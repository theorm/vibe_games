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
const TERRAIN_SEGMENTS = 128
const FLAT_ZONE_RADIUS = 400

export let terrainMesh: THREE.Mesh

export function createTerrain(): THREE.Mesh {
  const noise = createNoise2D()
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS)
  geo.rotateX(-Math.PI / 2)

  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)

    const distFromOrigin = Math.sqrt(x * x + z * z)
    const flatBlend = Math.min(1, Math.max(0, (distFromOrigin - FLAT_ZONE_RADIUS) / 600))

    const height =
      noise(x / 1200, z / 1200) * 300 +
      noise(x / 400, z / 400) * 60

    pos.setY(i, height * flatBlend)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  ;(geo as any).computeBoundsTree()

  const mat = new THREE.MeshStandardMaterial({
    color: 0x4a7c59,
    roughness: 1,
    metalness: 0,
  })

  terrainMesh = new THREE.Mesh(geo, mat)
  terrainMesh.receiveShadow = true
  return terrainMesh
}
