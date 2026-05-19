import * as THREE from 'three'
import { loadJet } from './plane'
import { setupControls, applyControls } from './controls'
import { createRunway } from './runway'
import { initPhysics } from './physics'
import { createTerrain } from './terrain'

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x87ceeb)
scene.fog = new THREE.Fog(0x87ceeb, 1000, 6000)

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 8000)
camera.position.set(0, 3, -15)

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

scene.add(createTerrain())

const runway = createRunway()
scene.add(runway)

function animate() {
  requestAnimationFrame(animate)
  applyControls(camera)
  renderer.render(scene, camera)
}

initPhysics().then(() => {
  loadJet(scene)
  setupControls(renderer.domElement)
  animate()
})
