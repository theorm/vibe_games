# Flight Simulator Tech Stack & Architecture

## Core Libraries

| Concern | Library | Why |
|---|---|---|
| Terrain collision | `three-mesh-bvh` | BVH raycasting against terrain mesh — O(log n), no physics engine needed |
| Terrain generation | `simplex-noise` | Procedural heightmap data fed into terrain geometry |
| Crash physics | `rapier3d` | Rigid body simulation **only at crash time** — narrow, well-defined job |
| Rendering | `three.js` | Already in use; `InstancedMesh`, `LOD`, `Sky` addon cover most needs |
| Aerodynamics | Custom math | Lift, drag, thrust, gravity — ~100 lines, no library fits this well |

---

## 1. Patch Three.js with BVH (once, at app startup)

```typescript
import * as THREE from 'three'
import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
} from 'three-mesh-bvh'

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
THREE.Mesh.prototype.raycast = acceleratedRaycast
```

---

## 2. Generate and Index Terrain

```typescript
import { createNoise2D } from 'simplex-noise'

const noise = createNoise2D()
const terrainGeo = new THREE.PlaneGeometry(20000, 20000, 512, 512)

// Displace vertices by noise height
const pos = terrainGeo.attributes.position
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i)
  const z = pos.getZ(i)
  pos.setY(i, noise(x / 2000, z / 2000) * 800)
}
pos.needsUpdate = true
terrainGeo.computeVertexNormals()

// Build the BVH spatial index — runs once on load (~200–400ms for 512×512)
terrainGeo.computeBoundsTree()

const terrainMesh = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial())
scene.add(terrainMesh)
```

---

## 3. Per-Frame Collision Checks

Instantiate the raycaster **once** outside the loop to avoid GC pressure.

```typescript
const raycaster = new THREE.Raycaster()
raycaster.firstHitOnly = true  // stops after the first BVH hit — critical for performance

const DOWN = new THREE.Vector3(0, -1, 0)

function updateFlightPhysics(
  planePosition: THREE.Vector3,
  planeVelocity: THREE.Vector3,
  deltaTime: number
) {
  // --- CHECK 1: Radar altimeter (straight down) ---
  raycaster.set(planePosition, DOWN)
  const altHits = raycaster.intersectObject(terrainMesh)

  if (altHits.length > 0) {
    const distanceToGround = altHits[0].distance
    if (distanceToGround < PLANE_ORIGIN_TO_WHEELS) {
      handleGroundContact(planeVelocity)  // soft land or hand off to Rapier
    }
  }

  // --- CHECK 2: Forward impact (anti-tunneling) ---
  // At high speed the plane can teleport through a mountain between frames.
  // Raycast in the direction of travel by exactly one frame's worth of movement.
  const travelDir = planeVelocity.clone().normalize()
  raycaster.set(planePosition, travelDir)
  const fwdHits = raycaster.intersectObject(terrainMesh)

  if (fwdHits.length > 0) {
    const distToObstacle = fwdHits[0].distance
    const moveThisFrame = planeVelocity.length() * deltaTime
    if (distToObstacle <= moveThisFrame) {
      triggerRapierCrash()
    }
  }
}
```

---

## Why This Architecture Excels

- **Zero physics overhead** for terrain — no simulating gravity/friction/resting contacts across thousands of polygons.
- **Anti-tunneling built-in** — forward raycast by `velocity × deltaTime` guarantees the plane never clips through a steep cliff at high speed.
- **Scales to a large world** — `raycaster.far` limits the query distance; only the relevant BVH nodes are visited regardless of total terrain size.
- **Rapier stays narrow** — rigid-body simulation only fires on crash, not every frame for every object.

---

## Aerodynamics Model (custom, no library)

The key forces applied each frame:

```
thrust    = throttle × maxThrust
lift      = 0.5 × airDensity × velocity² × wingArea × liftCoefficient(angleOfAttack)
drag      = 0.5 × airDensity × velocity² × dragCoefficient × referenceArea
weight    = mass × gravity (down)

netForce  = thrust(forward) + lift(up) + drag(−velocity) + weight(down)
velocity += (netForce / mass) × deltaTime
position += velocity × deltaTime
```

`liftCoefficient` peaks around 15° angle of attack then drops sharply (stall).
`airDensity` decreases with altitude (standard atmosphere model or a simple lookup table).

---

## Building / Object Collisions

For buildings and other aircraft, use AABB or sphere intersection against
`planeState.collidables` (already wired up in `controls.ts`).
Register any collidable object at creation time:

```typescript
planeState.collidables.push(buildingMesh)
```

On intersection → hand off to Rapier for crash simulation.
