import * as THREE from 'three'
import { planeState } from './plane'

const DEAD_ZONE    = 0.1
const MOVE_SPEED   = 0.05
const ROT_SPEED    = 0.02
const ZOOM_SPEED   = 0.2
const MOUSE_ROT    = 0.005
const MOUSE_MOVE   = 0.01
const PAN_SPEED    = 0.02
const THROTTLE_ACC   = 0.005  // speed added per frame while key held
const MAX_SPEED      = 0.8
const TAKEOFF_SPEED  = 0.4    // minimum speed required to lift off
const LIFT_ACC       = 0.01   // vertical acceleration while pulling up
const GRAVITY        = 0.005  // downward pull each frame
const MAX_VERT_SPEED = 0.3

export type ControlMode = 'camera' | 'plane'
export let controlMode: ControlMode = 'plane'

// Camera orbit state — matches initial camera.position (0, 3, -15) looking at target (0, 3, 0)
const orbit = {
  radius: 15,
  theta:  Math.PI,      // azimuth: PI puts camera at -Z
  phi:    Math.PI / 2,  // elevation: PI/2 = horizontal
  targetX: 0,
  targetY: 3,
  targetZ: 0,
}

let shiftHeld          = false
let mouseDx            = 0
let mouseDy            = 0
let throttleUp         = false
let throttleDown       = false
let pullUp             = false
let modeToggleWasHeld  = false

function updateModeUI(): void {
  let el = document.getElementById('control-mode')
  if (!el) {
    el = document.createElement('div')
    el.id = 'control-mode'
    el.style.cssText = [
      'position:fixed', 'top:10px', 'left:10px',
      'color:#fff', 'font:14px monospace',
      'background:rgba(0,0,0,.55)', 'padding:4px 10px',
      'border-radius:4px', 'pointer-events:none',
    ].join(';')
    document.body.appendChild(el)
  }
  el.textContent = `Mode: ${controlMode}  [Tab to toggle]`
}

export function setupControls(domElement: HTMLElement): void {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') shiftHeld = true
    if (e.key === 'Tab') {
      e.preventDefault()
      controlMode = controlMode === 'camera' ? 'plane' : 'camera'
      updateModeUI()
    }
    if (e.key === 'ArrowUp')   throttleUp   = true
    if (e.key === 'ArrowDown') throttleDown = true
    if (e.key === ' ')         pullUp       = true
  })
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift')     shiftHeld    = false
    if (e.key === 'ArrowUp')   throttleUp   = false
    if (e.key === 'ArrowDown') throttleDown = false
    if (e.key === ' ')         pullUp       = false
  })

  domElement.addEventListener('mousemove', (e) => {
    if (e.buttons === 0) return
    mouseDx += e.movementX
    mouseDy += e.movementY
  })

  updateModeUI()
}

function getGamepadInput(): { x: number; y: number; zoom: number; shift: boolean; triggerUp: number; triggerDown: number; modeToggle: boolean; pullUp: boolean } {
  const gamepads = navigator.getGamepads()
  for (const gp of gamepads) {
    if (!gp) continue
    const x          = Math.abs(gp.axes[0] ?? 0) > DEAD_ZONE ? (gp.axes[0] ?? 0) : 0
    const y          = Math.abs(gp.axes[1] ?? 0) > DEAD_ZONE ? (gp.axes[1] ?? 0) : 0
    const zoom       = Math.abs(gp.axes[3] ?? 0) > DEAD_ZONE ? (gp.axes[3] ?? 0) : 0
    const left       = gp.buttons[14]?.pressed ? -1 : 0
    const right      = gp.buttons[15]?.pressed ?  1 : 0
    const up         = gp.buttons[12]?.pressed ? -1 : 0
    const down       = gp.buttons[13]?.pressed ?  1 : 0
    const shift      = !!(gp.buttons[4]?.pressed || gp.buttons[5]?.pressed)
    const triggerUp   = gp.buttons[7]?.value ?? 0    // RT  — accelerate
    const triggerDown = gp.buttons[6]?.value ?? 0    // LT  — brake/reverse
    const modeToggle  = !!(gp.buttons[11]?.pressed)  // R3  — toggle camera/plane mode
    const gpPullUp    = !!(gp.buttons[0]?.pressed)   // A/Cross — pull up / climb
    return { x: x || (left + right), y: y || (up + down), zoom, shift, triggerUp, triggerDown, modeToggle, pullUp: gpPullUp }
  }
  return { x: 0, y: 0, zoom: 0, shift: false, triggerUp: 0, triggerDown: 0, modeToggle: false, pullUp: false }
}

function applyCameraOrbit(camera: THREE.Camera): void {
  const { radius, theta, phi, targetX, targetY, targetZ } = orbit
  camera.position.set(
    targetX + radius * Math.sin(phi) * Math.sin(theta),
    targetY + radius * Math.cos(phi),
    targetZ + radius * Math.sin(phi) * Math.cos(theta),
  )
  camera.lookAt(targetX, targetY, targetZ)
}

export function applyControls(camera: THREE.Camera): void {
  const { jet } = planeState
  if (!jet) return

  const gp = getGamepadInput()
  const shift = shiftHeld || gp.shift

  // Throttle: keyboard (digital) or gamepad triggers (analog, 0–1)
  // R3 toggles mode (debounced — only fires on the leading edge)
  if (gp.modeToggle && !modeToggleWasHeld) {
    controlMode = controlMode === 'camera' ? 'plane' : 'camera'
    updateModeUI()
  }
  modeToggleWasHeld = gp.modeToggle

  const accel = Math.max(throttleUp ? 1 : 0, gp.triggerUp)
  const brake = Math.max(throttleDown ? 1 : 0, gp.triggerDown)
  if (accel > 0) planeState.speed = Math.min(planeState.speed + THROTTLE_ACC * accel, MAX_SPEED)
  if (brake > 0) planeState.speed = Math.max(planeState.speed - THROTTLE_ACC * brake, -MAX_SPEED * 0.25)

  // Roll plane along runway and keep camera orbit target locked to it
  jet.position.z += planeState.speed
  orbit.targetZ = jet.position.z

  // Takeoff / flight
  const wantsPullUp = pullUp || gp.pullUp
  if (!planeState.isAirborne) {
    if (wantsPullUp && planeState.speed >= TAKEOFF_SPEED) {
      planeState.isAirborne = true
      planeState.verticalSpeed = LIFT_ACC
    }
  } else {
    planeState.verticalSpeed += wantsPullUp ? LIFT_ACC : -GRAVITY
    planeState.verticalSpeed = Math.max(-MAX_VERT_SPEED, Math.min(MAX_VERT_SPEED, planeState.verticalSpeed))
    planeState.y += planeState.verticalSpeed
    // Nose pitch matches vertical speed
    jet.rotation.x = -planeState.verticalSpeed / MAX_VERT_SPEED * (Math.PI / 6)
    // Land when back at ground level
    if (planeState.y <= planeState.groundY) {
      planeState.y = planeState.groundY
      planeState.verticalSpeed = 0
      planeState.isAirborne = false
      jet.rotation.x = 0
    }
  }
  jet.position.y = planeState.y
  orbit.targetY = planeState.y + 2

  if (controlMode === 'camera') {
    if (gp.x !== 0 || gp.y !== 0) {
      if (shift) {
        orbit.targetX -= gp.x * PAN_SPEED
        orbit.targetY += gp.y * PAN_SPEED
      } else {
        orbit.theta -= gp.x * ROT_SPEED
        orbit.phi    = Math.max(0.05, Math.min(Math.PI - 0.05, orbit.phi + gp.y * ROT_SPEED))
      }
    }
    if (gp.zoom !== 0) {
      orbit.radius = Math.max(1, orbit.radius + gp.zoom * ZOOM_SPEED)
    }

    if (mouseDx !== 0 || mouseDy !== 0) {
      if (shift) {
        orbit.targetX -= mouseDx * PAN_SPEED * 0.5
        orbit.targetY += mouseDy * PAN_SPEED * 0.5
      } else {
        orbit.theta -= mouseDx * MOUSE_ROT
        orbit.phi    = Math.max(0.05, Math.min(Math.PI - 0.05, orbit.phi + mouseDy * MOUSE_ROT))
      }
      mouseDx = 0
      mouseDy = 0
    }

    applyCameraOrbit(camera)
  } else {
    // plane mode
    if (gp.x !== 0 || gp.y !== 0) {
      if (shift) {
        planeState.x += gp.x * MOVE_SPEED
        planeState.y -= gp.y * MOVE_SPEED
        jet.position.set(planeState.x, planeState.y, jet.position.z)
      } else {
        jet.rotation.y -= gp.x * ROT_SPEED
        jet.rotation.x -= gp.y * ROT_SPEED
      }
    }
    if (gp.zoom !== 0) {
      camera.position.z += gp.zoom * ZOOM_SPEED
    }

    if (mouseDx !== 0 || mouseDy !== 0) {
      if (shift) {
        planeState.x += mouseDx * MOUSE_MOVE
        planeState.y -= mouseDy * MOUSE_MOVE
        jet.position.set(planeState.x, planeState.y, jet.position.z)
      } else {
        jet.rotation.y -= mouseDx * MOUSE_ROT
        jet.rotation.x -= mouseDy * MOUSE_ROT
      }
      mouseDx = 0
      mouseDy = 0
    }
  }
}
