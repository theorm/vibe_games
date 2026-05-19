import RAPIER from '@dimforge/rapier3d-compat'

let rapier: typeof RAPIER | null = null

// Active crash simulation state
let crashWorld: RAPIER.World | null = null
let crashBody: RAPIER.RigidBody | null = null

// Gravity tuned for game scale (maxDim=20 units, ~60fps movement)
const CRASH_GRAVITY = -40

export async function initPhysics(): Promise<void> {
  await RAPIER.init()
  rapier = RAPIER
}

export function startCrash(
  px: number, py: number, pz: number,
  qx: number, qy: number, qz: number, qw: number,
  vx: number, vy: number, vz: number
): void {
  if (!rapier) return

  crashWorld = new rapier.World({ x: 0, y: CRASH_GRAVITY, z: 0 })

  // Static ground — top face at y = 0
  const groundBody = crashWorld.createRigidBody(rapier.RigidBodyDesc.fixed())
  crashWorld.createCollider(
    rapier.ColliderDesc.cuboid(500, 0.5, 2000).setTranslation(0, -0.5, 0),
    groundBody
  )

  // Dynamic jet body with current pose and velocity
  const bodyDesc = rapier.RigidBodyDesc.dynamic()
    .setTranslation(px, py, pz)
    .setRotation({ x: qx, y: qy, z: qz, w: qw })
    .setLinvel(vx, vy, vz)
    .setAngvel({ x: 1.2, y: 0.8, z: 0.5 }) // dramatic tumble on impact

  crashBody = crashWorld.createRigidBody(bodyDesc)

  // Approximate jet bounding box half-extents (jet normalized to maxDim=20)
  crashWorld.createCollider(
    rapier.ColliderDesc.cuboid(10, 2.5, 7.5)
      .setRestitution(0.2)
      .setFriction(0.8),
    crashBody
  )
}

export interface CrashPose {
  px: number; py: number; pz: number
  qx: number; qy: number; qz: number; qw: number
}

export function stepCrash(): CrashPose | null {
  if (!crashWorld || !crashBody) return null

  if (!crashBody.isSleeping()) {
    crashWorld.step()
  }

  const t = crashBody.translation()
  const r = crashBody.rotation()
  return { px: t.x, py: t.y, pz: t.z, qx: r.x, qy: r.y, qz: r.z, qw: r.w }
}

export function resetCrash(): void {
  crashWorld = null
  crashBody = null
}
