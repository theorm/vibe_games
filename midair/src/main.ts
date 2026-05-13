import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

const scene = new THREE.Scene()

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.set(0, 2, 10)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
renderer.shadowMap.enabled = true
document.body.appendChild(renderer.domElement)

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
scene.add(ambientLight)

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5)
dirLight.position.set(10, 10, 10)
scene.add(dirLight)

let jet: THREE.Object3D | null = null
let jetX = 0
let jetY = 0

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')

const loader = new GLTFLoader()
loader.setDRACOLoader(dracoLoader)
loader.load(
  '/private_jet/source/LooL-compressed.glb',
  (gltf) => {
    jet = gltf.scene
    // Center and normalize scale so it's always visible
    const box = new THREE.Box3().setFromObject(jet)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    jet.position.sub(center)
    jet.scale.setScalar(3 / maxDim)
    scene.add(jet)
    console.log('jet loaded, normalized scale:', jet.scale.x)
  },
  undefined,
  (err) => console.error('Failed to load jet:', err)
)

// ── Keyboard + mouse/trackpad ────────────────────────────────────────────────
let shiftHeld = false
window.addEventListener('keydown', (e) => { if (e.key === 'Shift') shiftHeld = true })
window.addEventListener('keyup',   (e) => { if (e.key === 'Shift') shiftHeld = false })

// Accumulated mouse delta — consumed each frame
let mouseDx = 0
let mouseDy = 0

renderer.domElement.addEventListener('mousemove', (e) => {
  if (e.buttons === 0) return   // only while a button is held (click-drag)
  mouseDx += e.movementX
  mouseDy += e.movementY
})

// ── Gamepad ──────────────────────────────────────────────────────────────────
const DEAD_ZONE = 0.1

function getGamepadInput(): { x: number; y: number; zoom: number; shift: boolean } {
  const gamepads = navigator.getGamepads()
  for (const gp of gamepads) {
    if (!gp) continue
    const x    = Math.abs(gp.axes[0] ?? 0) > DEAD_ZONE ? (gp.axes[0] ?? 0) : 0
    const y    = Math.abs(gp.axes[1] ?? 0) > DEAD_ZONE ? (gp.axes[1] ?? 0) : 0
    const zoom = Math.abs(gp.axes[3] ?? 0) > DEAD_ZONE ? (gp.axes[3] ?? 0) : 0  // right stick Y
    // D-pad fallback
    const left  = gp.buttons[14]?.pressed ? -1 : 0
    const right = gp.buttons[15]?.pressed ?  1 : 0
    const up    = gp.buttons[12]?.pressed ? -1 : 0
    const down  = gp.buttons[13]?.pressed ?  1 : 0
    const shift = !!(gp.buttons[4]?.pressed || gp.buttons[5]?.pressed)  // L1 or R1
    return { x: x || (left + right), y: y || (up + down), zoom, shift }
  }
  return { x: 0, y: 0, zoom: 0, shift: false }
}

// ── Constants ────────────────────────────────────────────────────────────────
const MOVE_SPEED  = 0.05
const ROT_SPEED   = 0.02
const ZOOM_SPEED  = 0.2
const MOUSE_ROT   = 0.005
const MOUSE_MOVE  = 0.01

function animate() {
  requestAnimationFrame(animate)

  if (jet) {
    // --- Gamepad ---
    const gp = getGamepadInput()
    if (gp.x !== 0 || gp.y !== 0) {
      if (gp.shift) {
        jetX += gp.x * MOVE_SPEED
        jetY -= gp.y * MOVE_SPEED
        jet.position.set(jetX, jetY, 0)
      } else {
        jet.rotation.y -= gp.x * ROT_SPEED
        jet.rotation.x -= gp.y * ROT_SPEED
      }
    }
    if (gp.zoom !== 0) {
      camera.position.z += gp.zoom * ZOOM_SPEED
    }

    // --- Mouse / trackpad (click-drag) ---
    if (mouseDx !== 0 || mouseDy !== 0) {
      if (shiftHeld) {
        jetX += mouseDx * MOUSE_MOVE
        jetY -= mouseDy * MOUSE_MOVE
        jet.position.set(jetX, jetY, 0)
      } else {
        jet.rotation.y -= mouseDx * MOUSE_ROT
        jet.rotation.x -= mouseDy * MOUSE_ROT
      }
      mouseDx = 0
      mouseDy = 0
    }
  }

  renderer.render(scene, camera)
}

animate()
