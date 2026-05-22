# Collision System — Notes & Known Issues

## What's implemented

**Terrain proximity** (`hitsTerrainThisFrame` in `controls.ts`)
Uses `three-mesh-bvh`'s `closestPointToPoint` on the terrain BVH. Each frame while airborne, it asks: "is any terrain surface within 5 units of the plane's centre?" Returns in O(log n) and works from any approach angle.

**Flat-ground guard**
Hits where `point.y < 2` are ignored until the plane climbs 10 units above `groundY`. This prevents an immediate false-positive on takeoff, because the flat-zone terrain sits at y=0 — the same level as the runway.

**Object collisions**
AABB intersection against `planeState.collidables`. Any mesh pushed into that array is checked every frame.

**Crash handoff**
Any collision calls `triggerCrash()`, which passes the plane's current position, orientation, and velocity to Rapier for a rigid-body tumble simulation.

---

## What's fragile / incomplete

**5-unit radius is a guess.**
The plane is normalised to `20 / maxDim` scale. The Rapier box uses half-extents `(10, 2.5, 7.5)`, so the smallest cross-section radius is ~2.5 units. The 5-unit crash threshold is generous but hasn't been tuned against the actual model.

**Crash physics ignores terrain.**
When `triggerCrash` fires on a mountain, the Rapier world only has a flat ground plane at y=0. The plane's rigid body will fall through the mountain and land on invisible flat ground. For a proper fix, the terrain mesh (or a simplified collision mesh) needs to be registered as a static Rapier collider at crash time.

**Runway landing can still crash.**
The `CRASH_VERT_SPEED = 0.12` threshold is very low. A normal steep descent can exceed it, triggering a crash on what should be a hard but survivable landing. Consider raising the threshold or adding a landing-gear absorption model.

**No collidable terrain during crash tumble.**
`stepCrash` only steps the Rapier world, which has no knowledge of trees, hills, or buildings. The tumble looks correct on flat ground but clips through everything else.

**`planeState.collidables` is never populated.**
The AABB object-collision loop exists but nothing currently pushes into that array. Buildings, towers, or other obstacles need to call `planeState.collidables.push(mesh)` at creation time to be effective.

---

## What I'd do next

1. **Tune `TERRAIN_CRASH_DIST`** against the actual bounding box after the model loads — read `bbox` at load time in `plane.ts` and export a `planeRadius` constant.
2. **Register terrain with Rapier at crash time** — pass a simplified terrain collider (heightfield or trimesh) to `startCrash()` so the tumble stays on the mountain surface.
3. **Add a `closestPointToPoint` pre-check before AABB** for objects too — BVH proximity is cheaper than full bbox traversal for complex meshes.
