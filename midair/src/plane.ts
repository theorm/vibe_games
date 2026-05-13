import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

export const planeState = {
  jet: null as THREE.Object3D | null,
  x: 0,
  y: 0,
  groundY: 0,       // resting height on runway, set after model loads
  speed: 0,         // units/frame along +Z (runway direction)
  verticalSpeed: 0,
  isAirborne: false,
}

export function loadJet(scene: THREE.Scene): void {
  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')

  const loader = new GLTFLoader()
  loader.setDRACOLoader(dracoLoader)
  loader.load(
    '/private_jet/source/LooL-compressed.glb',
    (gltf) => {
      planeState.jet = gltf.scene
      const box = new THREE.Box3().setFromObject(planeState.jet)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      planeState.jet.position.sub(center)
      planeState.jet.scale.setScalar(20 / maxDim)

      // Lift plane so its bottom sits on the runway surface
      const scaledBox = new THREE.Box3().setFromObject(planeState.jet)
      planeState.y = planeState.jet.position.y - scaledBox.min.y
      planeState.groundY = planeState.y
      planeState.jet.position.y = planeState.y
      planeState.jet.position.z = -30

      scene.add(planeState.jet)
      console.log('jet loaded, normalized scale:', planeState.jet.scale.x)
    },
    undefined,
    (err) => console.error('Failed to load jet:', err)
  )
}
