import * as THREE from 'three'

const RUNWAY_WIDTH = 100
const RUNWAY_LENGTH = 3000

function createAsphaltTexture(): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#2a2a2a'
  ctx.fillRect(0, 0, size, size)

  // Asphalt grain noise
  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = Math.random() * 1.5
    const v = Math.floor(Math.random() * 40 + 20)
    ctx.fillStyle = `rgb(${v},${v},${v})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(4, 120)
  return texture
}

function createCenterlineTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 256
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = 'transparent'
  ctx.clearRect(0, 0, 64, 256)

  // Dashed white stripe
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.fillRect(16, 0, 32, 180)

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1, 40)
  return texture
}

function createThresholdMarkings(group: THREE.Group, zSign: number) {
  const pianoMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })
  const pianoCount = 6
  const pianoWidth = 10
  const pianoHeight = 0.02
  const pianoDepth = 30
  const spacing = (RUNWAY_WIDTH - 20) / (pianoCount - 1)

  for (let i = 0; i < pianoCount; i++) {
    const geo = new THREE.BoxGeometry(pianoWidth, pianoHeight, pianoDepth)
    const mesh = new THREE.Mesh(geo, pianoMat)
    mesh.position.set(
      -((RUNWAY_WIDTH - 20) / 2) + i * spacing,
      0.02,
      zSign * (RUNWAY_LENGTH / 2 - 50)
    )
    group.add(mesh)
  }
}

function createEdgeStripe(group: THREE.Group, xOffset: number) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })
  const geo = new THREE.BoxGeometry(2, 0.02, RUNWAY_LENGTH)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(xOffset, 0.015, 0)
  group.add(mesh)
}

function createRunwayLights(group: THREE.Group) {
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const lightGeo = new THREE.SphereGeometry(0.4, 6, 6)
  const spacing = 60
  const count = Math.floor(RUNWAY_LENGTH / spacing)
  const xOffsets = [-(RUNWAY_WIDTH / 2 + 2), RUNWAY_WIDTH / 2 + 2]

  for (const x of xOffsets) {
    for (let i = 0; i <= count; i++) {
      const mesh = new THREE.Mesh(lightGeo, lightMat)
      mesh.position.set(x, 0.4, -RUNWAY_LENGTH / 2 + i * spacing)
      group.add(mesh)
    }
  }

  // Green threshold lights at both ends
  const thresholdMat = new THREE.MeshBasicMaterial({ color: 0x00ff44 })
  const thresholdPositions = [-RUNWAY_LENGTH / 2, RUNWAY_LENGTH / 2]
  for (const z of thresholdPositions) {
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(lightGeo, thresholdMat)
      mesh.position.set(-RUNWAY_WIDTH / 2 + i * (RUNWAY_WIDTH / 7), 0.4, z)
      group.add(mesh)
    }
  }
}

export function createRunway(): THREE.Group {
  const group = new THREE.Group()

  // Asphalt base
  const asphaltTex = createAsphaltTexture()
  const asphaltMat = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    roughness: 0.9,
    metalness: 0.0,
    color: 0x333333,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  })
  const runwayGeo = new THREE.BoxGeometry(RUNWAY_WIDTH, 0.1, RUNWAY_LENGTH)
  const runway = new THREE.Mesh(runwayGeo, asphaltMat)
  runway.position.y = -0.05
  runway.receiveShadow = true
  group.add(runway)

  // Centerline dashes
  const centerlineTex = createCenterlineTexture()
  const centerlineMat = new THREE.MeshStandardMaterial({
    map: centerlineTex,
    transparent: true,
    roughness: 0.6,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  const centerlineGeo = new THREE.PlaneGeometry(4, RUNWAY_LENGTH)
  const centerline = new THREE.Mesh(centerlineGeo, centerlineMat)
  centerline.rotation.x = -Math.PI / 2
  centerline.position.y = 0.01
  group.add(centerline)

  // Threshold piano markings at both ends
  createThresholdMarkings(group, 1)
  createThresholdMarkings(group, -1)

  // Edge stripes
  createEdgeStripe(group, -(RUNWAY_WIDTH / 2 - 3))
  createEdgeStripe(group, RUNWAY_WIDTH / 2 - 3)

  // Runway lights
  createRunwayLights(group)

  return group
}
