import * as THREE from 'three'
import { planeState } from './plane'
import { startCrash, stepCrash, resetCrash } from './physics'
import { terrainMesh } from './terrain'

// ── Tuning ────────────────────────────────────────────────────────────────────
const DEAD_ZONE        = 0.12
const THROTTLE_ACC     = 0.012   // speed units/frame per trigger unit
const MAX_SPEED        = 1.2     // units/frame max forward
const TAKEOFF_SPEED    = 0.3     // min speed to lift off
const GRAVITY          = 0.004   // downward accel/frame while airborne
const MAX_VERT_SPEED   = 0.35    // max climb/sink rate
const ROLL_RATE        = 0.038   // rad/frame at full stick input
const YAW_RATE         = 0.018   // rad/frame at full bumper press
const MAX_PITCH        = Math.PI / 4     // ≈45° max visual pitch
const MAX_ROLL         = Math.PI * 0.44  // ≈79°, can't roll past vertical
const ROLL_RETURN      = 0.05    // fraction to level wings per frame (no input)
const ROLL_GRAVITY     = 0.015   // extra return force per radian past 45° (progressive)
const TURN_RATE        = 0.006   // additional heading contribution from banked rollAngle
const CRASH_VERT_SPEED = 0.12    // downward speed at impact that triggers crash
const SURFACE_Y        = 0       // top of runway surface
const DRAG             = 0.001   // passive speed loss per frame (air resistance)
const CLIMB_DRAG       = 0.006   // extra speed loss per sin(pitch) while climbing

const YAW_FROM_ROLL    = 0.022   // direct heading change per unit of roll input

// Chase camera
const CHASE_RADIUS     = 35
const CHASE_PHI        = 1.25    // polar angle from zenith (≈72°, behind-and-above)
const CAM_ROT_SPEED    = 0.035   // right-stick camera rotation speed
const CAM_RETURN_SPEED = 0.07    // speed at which camera re-centres when stick released
const CAM_PHI_LIMIT    = 0.8     // max phi offset from chase default
const MOUSE_CAM_SPEED  = 0.004   // mouse-drag camera speed

// ── BVH proximity check (reuse target to avoid GC) ───────────────────────────
const TERRAIN_CRASH_DIST = 5    // units — approx half the plane's scaled height
const _bvhHit: any = { point: new THREE.Vector3() }

// ── Attitude & camera state ───────────────────────────────────────────────────
let pitchAngle     = 0   // rad; positive = nose up
let rollAngle      = 0   // rad; positive = bank right (right wing down)
let heading        = 0   // rad; 0 = +Z forward; increases counterclockwise (left)

let camThetaOffset = 0   // user look-around offsets, auto-return to 0
let camPhiOffset   = 0

let mouseDx = 0
let mouseDy = 0

// ── Keyboard state ────────────────────────────────────────────────────────────
let keyPitchUp   = false
let keyPitchDown = false
let keyRollLeft  = false
let keyRollRight = false
let keyYawLeft   = false
let keyYawRight  = false
let keyThrottle  = false
let keyBrake     = false
let keyPullUp    = false
let keyRestart   = false

let prevRestartBtn = false   // edge detection: only fire once per press

// ── Gamepad ───────────────────────────────────────────────────────────────────
interface GPInput {
  pitch:       number    // −1..1, positive = nose up  (left stick Y, inverted)
  roll:        number    // −1..1, positive = bank right (left stick X)
  yawLeft:     boolean   // LB bumper → rudder left
  yawRight:    boolean   // RB bumper → rudder right
  throttleInc: number    // 0..1  RT → accelerate
  throttleDec: number    // 0..1  LT → brake
  pullUp:      boolean   // A/Cross → pull up (takeoff + climb)
  camX:        number    // right stick X → look left/right
  camY:        number    // right stick Y → look up/down
  camReset:    boolean   // R3 → snap camera behind plane
  restart:     boolean   // Start/Menu → restart game
}

function dz(v: number): number {
  return Math.abs(v) > DEAD_ZONE ? v : 0
}

function getGamepadInput(): GPInput {
  for (const gp of navigator.getGamepads()) {
    if (!gp) continue
    return {
      pitch:       -dz(gp.axes[1] ?? 0),          // left stick Y, inverted: up = nose up
      roll:         dz(gp.axes[0] ?? 0),           // left stick X
      yawLeft:      !!(gp.buttons[4]?.pressed),    // LB
      yawRight:     !!(gp.buttons[5]?.pressed),    // RB
      throttleInc:  gp.buttons[7]?.value ?? 0,     // RT
      throttleDec:  gp.buttons[6]?.value ?? 0,     // LT
      pullUp:       !!(gp.buttons[0]?.pressed),    // A/Cross — pull up / takeoff
      camX:         dz(gp.axes[2] ?? 0),           // right stick X
      camY:         dz(gp.axes[3] ?? 0),           // right stick Y
      camReset:     !!(gp.buttons[11]?.pressed),   // R3
      restart:      !!(gp.buttons[9]?.pressed),    // Start/Menu
    }
  }
  return { pitch: 0, roll: 0, yawLeft: false, yawRight: false,
           throttleInc: 0, throttleDec: 0, pullUp: false, camX: 0, camY: 0, camReset: false, restart: false }
}

// ── Chase camera ──────────────────────────────────────────────────────────────
function applyChaseCam(camera: THREE.Camera): void {
  const { jet } = planeState
  if (!jet) return

  const tx = jet.position.x
  const ty = jet.position.y + 2
  const tz = jet.position.z

  // theta tracks heading so camera always stays behind the nose
  const theta = heading + Math.PI + camThetaOffset
  const phi   = Math.max(0.05, Math.min(Math.PI - 0.05, CHASE_PHI + camPhiOffset))

  camera.position.set(
    tx + CHASE_RADIUS * Math.sin(phi) * Math.sin(theta),
    ty + CHASE_RADIUS * Math.cos(phi),
    tz + CHASE_RADIUS * Math.sin(phi) * Math.cos(theta),
  )
  camera.lookAt(tx, ty, tz)
}

// ── HUD ───────────────────────────────────────────────────────────────────────
function updateHUD(): void {
  let el = document.getElementById('flight-hud')
  if (!el) {
    el = document.createElement('div')
    el.id = 'flight-hud'
    el.style.cssText = [
      'position:fixed', 'top:10px', 'left:10px',
      'color:#fff', 'font:14px monospace',
      'background:rgba(0,0,0,.55)', 'padding:6px 14px',
      'border-radius:4px', 'pointer-events:none', 'line-height:1.6',
    ].join(';')
    document.body.appendChild(el)
  }
  const thr = Math.round(planeState.speed / MAX_SPEED * 100)
  const alt = Math.max(0, Math.round((planeState.y - planeState.groundY) * 10))
  const status = planeState.crashed ? 'CRASHED' : planeState.isAirborne ? 'AIRBORNE' : 'ON GROUND'
  el.innerHTML = `THR ${String(thr).padStart(3)}%&nbsp; ALT ${String(alt).padStart(5)}&nbsp; ${status}`
}

// ── Setup ─────────────────────────────────────────────────────────────────────
export function setupControls(domElement: HTMLElement): void {
  window.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowUp':                        keyThrottle  = true;  e.preventDefault(); break
      case 'ArrowDown':                      keyBrake     = true;  e.preventDefault(); break
      case 'ArrowLeft':                      keyRollLeft  = true;  e.preventDefault(); break
      case 'ArrowRight':                     keyRollRight = true;  e.preventDefault(); break
      case 'w': case 'W':                    keyPitchUp   = true;  break
      case 's': case 'S':                    keyPitchDown = true;  break
      case 'a': case 'A':                    keyRollLeft  = true;  break
      case 'd': case 'D':                    keyRollRight = true;  break
      case 'q': case 'Q':                    keyYawLeft   = true;  break
      case 'e': case 'E':                    keyYawRight  = true;  break
      case 'Shift':                          keyThrottle  = true;  break
      case 'Control':                        keyBrake     = true;  break
      case ' ':                              keyPullUp    = true;  e.preventDefault(); break
      case 'r': case 'R':                    keyRestart   = true;  break
    }
  })
  window.addEventListener('keyup', (e) => {
    switch (e.key) {
      case 'ArrowUp':                        keyThrottle  = false; break
      case 'ArrowDown':                      keyBrake     = false; break
      case 'ArrowLeft':                      keyRollLeft  = false; break
      case 'ArrowRight':                     keyRollRight = false; break
      case 'w': case 'W':                    keyPitchUp   = false; break
      case 's': case 'S':                    keyPitchDown = false; break
      case 'a': case 'A':                    keyRollLeft  = false; break
      case 'd': case 'D':                    keyRollRight = false; break
      case 'q': case 'Q':                    keyYawLeft   = false; break
      case 'e': case 'E':                    keyYawRight  = false; break
      case 'Shift':                          keyThrottle  = false; break
      case 'Control':                        keyBrake     = false; break
      case ' ':                              keyPullUp    = false; break
    }
  })
  domElement.addEventListener('mousemove', (e) => {
    if (e.buttons === 0) return
    mouseDx += e.movementX
    mouseDy += e.movementY
  })
}

// ── Crash ─────────────────────────────────────────────────────────────────────
function triggerCrash(jet: THREE.Object3D): void {
  planeState.crashed    = true
  planeState.isAirborne = false

  // Full 3D velocity at impact (units/frame → units/sec at 60 fps)
  const vx = Math.sin(heading) * planeState.speed * 60
  const vy = planeState.verticalSpeed * 60
  const vz = Math.cos(heading) * planeState.speed * 60

  const { x: qx, y: qy, z: qz, w: qw } = jet.quaternion
  startCrash(jet.position.x, jet.position.y, jet.position.z, qx, qy, qz, qw, vx, vy, vz)

  planeState.speed         = 0
  planeState.verticalSpeed = 0
}

// ── Terrain collision via BVH proximity ──────────────────────────────────────
// Uses three-mesh-bvh's closestPointToPoint: finds nearest terrain surface to
// the plane center in O(log n), reliable from any approach angle.
function hitsTerrainThisFrame(jet: THREE.Object3D): boolean {
  if (!terrainMesh) return false
  const bvh = (terrainMesh.geometry as any).boundsTree
  if (!bvh) return false

  const hit = bvh.closestPointToPoint(jet.position, _bvhHit, 0, TERRAIN_CRASH_DIST)
  if (!hit) return false

  // Ignore flat ground (y≈0) during takeoff roll and initial climb — the runway
  // sits on the same y=0 plane as the flat-zone terrain
  if (_bvhHit.point.y < 2 && planeState.y - planeState.groundY < 10) return false

  return true
}

// ── Collision resolution ──────────────────────────────────────────────────────
function resolveCollisions(jet: THREE.Object3D): void {
  jet.updateMatrixWorld(true)
  const bbox = new THREE.Box3().setFromObject(jet)

  if (bbox.min.y < SURFACE_Y) {
    const penetration = SURFACE_Y - bbox.min.y
    planeState.y += penetration
    jet.position.y = planeState.y

    if (planeState.isAirborne && planeState.verticalSpeed < -CRASH_VERT_SPEED) {
      triggerCrash(jet)
      return
    }
    // Only settle to ground when not actively climbing — preserves takeoff
    if (planeState.verticalSpeed <= 0) {
      planeState.verticalSpeed = 0
      planeState.isAirborne    = false
      pitchAngle               = 0
      rollAngle                = 0
      jet.rotation.set(0, heading, 0, 'YXZ')
    }
  }

  // Terrain crash: any contact with hills/mountains while airborne = crash
  if (!planeState.crashed && planeState.isAirborne && hitsTerrainThisFrame(jet)) {
    triggerCrash(jet)
    return
  }

  if (!planeState.crashed) {
    for (const obj of planeState.collidables) {
      const objBbox = new THREE.Box3().setFromObject(obj)
      if (bbox.intersectsBox(objBbox)) {
        triggerCrash(jet)
        return
      }
    }
  }
}

// ── Reset ─────────────────────────────────────────────────────────────────────
function resetGame(): void {
  const { jet } = planeState
  if (!jet) return

  planeState.speed         = 0
  planeState.verticalSpeed = 0
  planeState.isAirborne    = false
  planeState.crashed       = false
  planeState.y             = planeState.groundY
  planeState.x             = 0

  jet.position.set(0, planeState.groundY, -30)
  pitchAngle     = 0
  rollAngle      = 0
  heading        = 0
  camThetaOffset = 0
  camPhiOffset   = 0
  jet.rotation.set(0, 0, 0, 'YXZ')
  resetCrash()
}

// ── Main per-frame update ─────────────────────────────────────────────────────
export function applyControls(camera: THREE.Camera): void {
  const { jet } = planeState
  if (!jet) return

  const gp = getGamepadInput()

  // ── Restart ─────────────────────────────────────────────────────────────────
  const restartPressed = (gp.restart && !prevRestartBtn) || keyRestart
  prevRestartBtn = gp.restart
  keyRestart     = false
  if (restartPressed) { resetGame() }

  if (planeState.crashed) {
    const pose = stepCrash()
    if (pose) {
      jet.position.set(pose.px, pose.py, pose.pz)
      jet.quaternion.set(pose.qx, pose.qy, pose.qz, pose.qw)
    }
    applyChaseCam(camera)
    updateHUD()
    return
  }

  // ── Throttle ────────────────────────────────────────────────────────────────
  const incInput = Math.max(keyThrottle ? 1 : 0, gp.throttleInc)
  const decInput = Math.max(keyBrake   ? 1 : 0, gp.throttleDec)
  if (incInput > 0) planeState.speed = Math.min(planeState.speed + THROTTLE_ACC * incInput, MAX_SPEED)
  if (decInput > 0) planeState.speed = Math.max(planeState.speed - THROTTLE_ACC * decInput * 2, 0)

  // ── Pitch (left stick Y, A button, Space) ────────────────────────────────
  // pullUp sources: A/Cross button, Space key — always mean "nose up"
  const pullUpInput = (gp.pullUp || keyPullUp) ? 1 : 0
  const pitchInput  = gp.pitch + (keyPitchUp ? 1 : 0) - (keyPitchDown ? 1 : 0) + pullUpInput
  // Only apply pitch visually when airborne; on ground the plane stays flat
  if (planeState.isAirborne) {
    pitchAngle = Math.max(-1, Math.min(1, pitchInput)) * MAX_PITCH
  } else {
    pitchAngle = 0
  }

  // ── Roll / bank (left stick X): accumulated for visual banking feel ────────
  const rollInput = gp.roll + (keyRollRight ? 1 : 0) - (keyRollLeft ? 1 : 0)
  if (rollInput !== 0) {
    rollAngle = Math.max(-MAX_ROLL, Math.min(MAX_ROLL, rollAngle + rollInput * ROLL_RATE))
  } else {
    rollAngle *= 1 - ROLL_RETURN
  }
  // Progressive gravity pull toward level: increases beyond 45° so steep banks self-recover
  if (planeState.isAirborne) {
    const overBank = Math.max(0, Math.abs(rollAngle) - Math.PI / 4)
    rollAngle -= Math.sign(rollAngle) * overBank * ROLL_GRAVITY
  }

  // ── Yaw / rudder (LB = left, RB = right) ─────────────────────────────────
  const yawDelta = (gp.yawLeft  || keyYawLeft  ? 1 : 0)
                 - (gp.yawRight || keyYawRight ? 1 : 0)
  heading += yawDelta * YAW_RATE

  if (planeState.isAirborne) {
    // Direct yaw from roll: immediate heading change (arcade feel)
    heading -= rollInput * YAW_FROM_ROLL
    // Sustained bank also contributes to turn (coordinated turn feel)
    heading -= rollAngle * TURN_RATE
  }

  // ── Horizontal movement (heading-driven so plane flies where it points) ───
  jet.position.x += Math.sin(heading) * planeState.speed
  jet.position.z += Math.cos(heading) * planeState.speed

  // ── Speed decay (drag + gravity penalty for climbing) ────────────────────
  if (planeState.isAirborne) {
    planeState.speed = Math.max(0,
      planeState.speed - DRAG - Math.max(0, Math.sin(pitchAngle)) * CLIMB_DRAG)
  }

  // ── Vertical movement ─────────────────────────────────────────────────────
  if (planeState.isAirborne) {
    const speedRatio  = planeState.speed / MAX_SPEED
    const bankCos     = Math.max(0, Math.cos(rollAngle))
    const liftFactor  = speedRatio * bankCos

    // Accumulate vertical speed: lift cancels gravity at cruise; stall = freefall builds up
    const liftAccel  = (liftFactor - 1) * GRAVITY                         // 0 at full speed+level, negative otherwise
    const pitchAccel = Math.sin(pitchAngle) * GRAVITY * 3 * speedRatio    // pitch only helps when moving
    planeState.verticalSpeed = Math.max(-MAX_VERT_SPEED, Math.min(MAX_VERT_SPEED,
      planeState.verticalSpeed + liftAccel + pitchAccel))
    planeState.y += planeState.verticalSpeed

    if (planeState.y <= planeState.groundY) {
      planeState.y             = planeState.groundY
      planeState.verticalSpeed = 0
      planeState.isAirborne    = false
      pitchAngle               = 0
      rollAngle                = 0
    }
  } else {
    // On ground: left stick X steers (nose-wheel), pitch/roll stay flat
    pitchAngle   = 0
    rollAngle    = 0
    planeState.y = planeState.groundY
    heading     -= gp.roll * YAW_RATE * 2   // left stick X → ground steering (right = turn right)

    // Takeoff: pitch stick up, A button, or Space at sufficient speed
    if (planeState.speed >= TAKEOFF_SPEED && pitchInput > 0.1) {
      planeState.isAirborne    = true
      planeState.verticalSpeed = 0.02
    }
  }

  // ── Apply attitude rotation (YXZ order = yaw → pitch → roll) ─────────────
  jet.rotation.set(-pitchAngle, heading, rollAngle, 'YXZ')
  jet.position.y = planeState.y
  planeState.x   = jet.position.x

  // ── Chase camera: right stick look-around, auto-recentres on release ──────
  if (gp.camReset) {
    camThetaOffset = 0
    camPhiOffset   = 0
  } else {
    camThetaOffset += gp.camX * CAM_ROT_SPEED
    camPhiOffset   += gp.camY * CAM_ROT_SPEED
    camPhiOffset    = Math.max(-CAM_PHI_LIMIT, Math.min(CAM_PHI_LIMIT, camPhiOffset))
    if (gp.camX === 0 && mouseDx === 0) camThetaOffset *= 1 - CAM_RETURN_SPEED
    if (gp.camY === 0 && mouseDy === 0) camPhiOffset   *= 1 - CAM_RETURN_SPEED
  }

  if (mouseDx !== 0 || mouseDy !== 0) {
    camThetaOffset += mouseDx * MOUSE_CAM_SPEED
    camPhiOffset   += mouseDy * MOUSE_CAM_SPEED
    camPhiOffset    = Math.max(-CAM_PHI_LIMIT, Math.min(CAM_PHI_LIMIT, camPhiOffset))
    mouseDx = 0
    mouseDy = 0
  }

  resolveCollisions(jet)
  applyChaseCam(camera)
  updateHUD()
}
