import * as THREE from 'three'
import { planeState } from './plane'

const DEAD_ZONE  = 0.1
const MOVE_SPEED = 0.05
const ROT_SPEED  = 0.02
const ZOOM_SPEED = 0.2
const MOUSE_ROT  = 0.005
const MOUSE_MOVE = 0.01

let shiftHeld = false
let mouseDx   = 0
let mouseDy   = 0

export function setupControls(domElement: HTMLElement): void {
  window.addEventListener('keydown', (e) => { if (e.key === 'Shift') shiftHeld = true })
  window.addEventListener('keyup',   (e) => { if (e.key === 'Shift') shiftHeld = false })

  domElement.addEventListener('mousemove', (e) => {
    if (e.buttons === 0) return
    mouseDx += e.movementX
    mouseDy += e.movementY
  })
}

function getGamepadInput(): { x: number; y: number; zoom: number; shift: boolean } {
  const gamepads = navigator.getGamepads()
  for (const gp of gamepads) {
    if (!gp) continue
    const x    = Math.abs(gp.axes[0] ?? 0) > DEAD_ZONE ? (gp.axes[0] ?? 0) : 0
    const y    = Math.abs(gp.axes[1] ?? 0) > DEAD_ZONE ? (gp.axes[1] ?? 0) : 0
    const zoom = Math.abs(gp.axes[3] ?? 0) > DEAD_ZONE ? (gp.axes[3] ?? 0) : 0
    const left  = gp.buttons[14]?.pressed ? -1 : 0
    const right = gp.buttons[15]?.pressed ?  1 : 0
    const up    = gp.buttons[12]?.pressed ? -1 : 0
    const down  = gp.buttons[13]?.pressed ?  1 : 0
    const shift = !!(gp.buttons[4]?.pressed || gp.buttons[5]?.pressed)
    return { x: x || (left + right), y: y || (up + down), zoom, shift }
  }
  return { x: 0, y: 0, zoom: 0, shift: false }
}

export function applyControls(camera: THREE.Camera): void {
  const { jet } = planeState
  if (!jet) return

  const gp = getGamepadInput()
  if (gp.x !== 0 || gp.y !== 0) {
    if (gp.shift) {
      planeState.x += gp.x * MOVE_SPEED
      planeState.y -= gp.y * MOVE_SPEED
      jet.position.set(planeState.x, planeState.y, 0)
    } else {
      jet.rotation.y -= gp.x * ROT_SPEED
      jet.rotation.x -= gp.y * ROT_SPEED
    }
  }
  if (gp.zoom !== 0) {
    camera.position.z += gp.zoom * ZOOM_SPEED
  }

  if (mouseDx !== 0 || mouseDy !== 0) {
    if (shiftHeld) {
      planeState.x += mouseDx * MOUSE_MOVE
      planeState.y -= mouseDy * MOUSE_MOVE
      jet.position.set(planeState.x, planeState.y, 0)
    } else {
      jet.rotation.y -= mouseDx * MOUSE_ROT
      jet.rotation.x -= mouseDy * MOUSE_ROT
    }
    mouseDx = 0
    mouseDy = 0
  }
}
