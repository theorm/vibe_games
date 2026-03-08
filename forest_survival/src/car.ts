// Car mesh, position, and drive logic — upgraded glossy sports sedan
// THREE is loaded from CDN as a global; @types/three provides TS typing.
declare const THREE: typeof import('three');

import { renderer, scene } from './scene.js';
import { CAR_SPD, CAR_TURN } from './constants.js';
import { gameState, keys } from './state.js';
import { player } from './player.js';
import { checkWorldCollision } from './world.js';

export const carPos = new THREE.Vector3(0, 0, -5);
export const carGroup = new THREE.Group();
scene.add(carGroup);

const wheelSpinners: import('three').Object3D[] = [];
const steerKnuckles: import('three').Object3D[] = [];

interface EnvMatTarget {
  mat: import('three').Material & { envMap?: import('three').Texture | null; envMapIntensity?: number };
  intensity: number;
}

const envTargets: EnvMatTarget[] = [];
function registerEnvMaterial<T extends import('three').Material>(
  mat: T,
  intensity: number
): T {
  envTargets.push({
    mat: mat as EnvMatTarget['mat'],
    intensity,
  });
  return mat;
}

// Keep the PMREM render target alive for the life of the game.
let carEnvRT: import('three').WebGLRenderTarget | null = null;

// ── Procedural texture maps ──────────────────────────────

function makeFlakeNormalMap(): import('three').CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 13000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 0.25 + Math.random() * 0.9;
    const nx = 128 + (Math.random() - 0.5) * 36;
    const ny = 128 + (Math.random() - 0.5) * 36;
    const nz = 220 + Math.random() * 35;

    ctx.fillStyle = `rgb(${nx | 0},${ny | 0},${nz | 0})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  return tex;
}

function makeTireNormalMap(): import('three').CanvasTexture {
  const width = 512;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, width, height);

  for (let i = -2; i < 66; i++) {
    const x = (i / 64) * width;

    ctx.fillStyle = '#6666dc';
    ctx.fillRect(x, height * 0.18, 6, height * 0.64);

    ctx.save();
    ctx.translate(x + 3, height * 0.5);
    ctx.rotate(0.47);
    ctx.fillStyle = '#7373eb';
    ctx.fillRect(-2, -height * 0.35, 4, height * 0.7);
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.6, 1);
  return tex;
}

const carTextureLoader = new THREE.TextureLoader();
const carTextureAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

function loadCarTexture(
  path: string,
  repeatX: number,
  repeatY: number,
  isColor: boolean
): import('three').Texture {
  const tex = carTextureLoader.load(path);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = carTextureAniso;
  if (isColor) tex.encoding = THREE.sRGBEncoding;
  return tex;
}

// ── Materials ────────────────────────────────────────────

const paintFlakeNormal = makeFlakeNormalMap();
const tireFallbackNormal = makeTireNormalMap();

const metalDiffMap = loadCarTexture('assets/textures/car/metal_plate_02_diff_1k.jpg', 3, 3, true);
const metalArmMap = loadCarTexture('assets/textures/car/metal_plate_02_arm_1k.png', 3, 3, false);
const metalNorMap = loadCarTexture('assets/textures/car/metal_plate_02_nor_gl_1k.png', 3, 3, false);

const rubberDiffMap = loadCarTexture('assets/textures/car/rubber_tiles_diff_1k.jpg', 2.4, 1.2, true);
const rubberArmMap = loadCarTexture('assets/textures/car/rubber_tiles_arm_1k.png', 2.4, 1.2, false);
const rubberNorMap = loadCarTexture('assets/textures/car/rubber_tiles_nor_gl_1k.png', 2.4, 1.2, false);

const leatherDiffMap = loadCarTexture('assets/textures/car/leather_red_02_coll1_1k.jpg', 3.5, 2, true);
const leatherArmMap = loadCarTexture('assets/textures/car/leather_red_02_arm_1k.png', 3.5, 2, false);
const leatherNorMap = loadCarTexture('assets/textures/car/leather_red_02_nor_gl_1k.png', 3.5, 2, false);

const paint = registerEnvMaterial(
  new THREE.MeshPhysicalMaterial({
    color: 0x9e101f,
    metalness: 0.54,
    roughness: 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.035,
    normalMap: paintFlakeNormal,
    normalScale: new THREE.Vector2(0.1, 0.1),
    clearcoatNormalMap: paintFlakeNormal,
    clearcoatNormalScale: new THREE.Vector2(0.04, 0.04),
  }),
  1.65
);

const chrome = registerEnvMaterial(
  new THREE.MeshStandardMaterial({
    color: 0xf3f5f8,
    map: metalDiffMap,
    normalMap: metalNorMap,
    normalScale: new THREE.Vector2(0.24, 0.24),
    roughnessMap: metalArmMap,
    metalnessMap: metalArmMap,
    metalness: 1.0,
    roughness: 0.24,
  }),
  1.85
);

const darkTrim = registerEnvMaterial(
  new THREE.MeshStandardMaterial({
    color: 0x151b23,
    map: metalDiffMap,
    normalMap: metalNorMap,
    normalScale: new THREE.Vector2(0.12, 0.12),
    roughnessMap: metalArmMap,
    metalnessMap: metalArmMap,
    metalness: 0.5,
    roughness: 0.58,
  }),
  1.0
);

const glass = registerEnvMaterial(
  new THREE.MeshPhysicalMaterial({
    color: 0x1f3346,
    transparent: true,
    opacity: 0.34,
    metalness: 0.0,
    roughness: 0.03,
    reflectivity: 0.95,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    side: THREE.DoubleSide,
  }),
  2.05
);

const tireMat = new THREE.MeshStandardMaterial({
  color: 0x202126,
  map: rubberDiffMap,
  roughnessMap: rubberArmMap,
  metalnessMap: rubberArmMap,
  metalness: 0.06,
  roughness: 1.0,
  normalMap: rubberNorMap,
  normalScale: new THREE.Vector2(1.0, 1.0),
});

const rimMat = registerEnvMaterial(
  new THREE.MeshStandardMaterial({
    color: 0xe4e8ed,
    map: metalDiffMap,
    normalMap: metalNorMap,
    normalScale: new THREE.Vector2(0.34, 0.34),
    roughnessMap: metalArmMap,
    metalnessMap: metalArmMap,
    metalness: 1.0,
    roughness: 0.2,
  }),
  1.75
);

const headlightLensMat = registerEnvMaterial(
  new THREE.MeshPhysicalMaterial({
    color: 0xe8f3ff,
    transparent: true,
    opacity: 0.82,
    metalness: 0.15,
    roughness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
  }),
  1.7
);

const headlightCoreMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0xfff4bf,
  emissiveIntensity: 0.95,
  metalness: 0.15,
  roughness: 0.25,
});

const taillightMat = registerEnvMaterial(
  new THREE.MeshPhysicalMaterial({
    color: 0xff1e15,
    emissive: 0xb40000,
    emissiveIntensity: 1.0,
    transparent: true,
    opacity: 0.88,
    metalness: 0.2,
    roughness: 0.15,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
  }),
  1.2
);

const plateMat = new THREE.MeshStandardMaterial({
  color: 0xe7e7e7,
  metalness: 0.0,
  roughness: 0.22,
});

const grilleMat = new THREE.MeshStandardMaterial({
  color: 0x090a0d,
  metalness: 0.7,
  roughness: 0.35,
});

const interiorLeatherMat = new THREE.MeshStandardMaterial({
  color: 0xa82827,
  map: leatherDiffMap,
  normalMap: leatherNorMap,
  normalScale: new THREE.Vector2(0.42, 0.42),
  roughnessMap: leatherArmMap,
  metalnessMap: leatherArmMap,
  metalness: 0.05,
  roughness: 0.76,
});

const interiorPlasticMat = new THREE.MeshStandardMaterial({
  color: 0x1f2126,
  roughness: 0.75,
  metalness: 0.08,
  normalMap: tireFallbackNormal,
  normalScale: new THREE.Vector2(0.16, 0.16),
});

const brakeDiscMat = new THREE.MeshStandardMaterial({
  color: 0x888f9c,
  map: metalDiffMap,
  normalMap: metalNorMap,
  normalScale: new THREE.Vector2(0.14, 0.14),
  roughnessMap: metalArmMap,
  metalnessMap: metalArmMap,
  metalness: 0.95,
  roughness: 0.42,
});

// ── Helpers ──────────────────────────────────────────────

function createPanelLine(width: number, x: number, y: number, z: number): void {
  const line = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.012, 0.012),
    darkTrim
  );
  line.position.set(x, y, z);
  carGroup.add(line);
}

function createDoorHandle(x: number, y: number, z: number): void {
  const h = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.03, 0.02),
    chrome
  );
  h.position.set(x, y, z);
  carGroup.add(h);
}

function createSeat(x: number, z: number, y: number): void {
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.16, 0.54),
    interiorLeatherMat
  );
  base.position.set(x, y, z);
  base.castShadow = true;
  carGroup.add(base);

  const back = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.5, 0.54),
    interiorLeatherMat
  );
  back.position.set(x - 0.18, y + 0.33, z);
  back.castShadow = true;
  carGroup.add(back);

  const headrest = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.16, 0.32),
    interiorLeatherMat
  );
  headrest.position.set(x - 0.27, y + 0.66, z);
  carGroup.add(headrest);
}

function createWheel(x: number, z: number, isFront: boolean): void {
  const knuckle = new THREE.Group();
  knuckle.position.set(x, 0.44, z);
  carGroup.add(knuckle);

  const spinner = new THREE.Group();
  knuckle.add(spinner);
  wheelSpinners.push(spinner);
  if (isFront) steerKnuckles.push(knuckle);

  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.3, 32, 1, true),
    tireMat
  );
  tire.rotation.x = Math.PI / 2;
  spinner.add(tire);

  const sideWallFront = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 32),
    tireMat
  );
  sideWallFront.position.z = 0.15;
  spinner.add(sideWallFront);

  const sideWallBack = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 32),
    tireMat
  );
  sideWallBack.position.z = -0.15;
  sideWallBack.rotation.y = Math.PI;
  spinner.add(sideWallBack);

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.27, 0.22, 28),
    rimMat
  );
  rim.rotation.x = Math.PI / 2;
  spinner.add(rim);

  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.12, 22),
    brakeDiscMat
  );
  disc.rotation.x = Math.PI / 2;
  spinner.add(disc);

  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.18, 0.03),
      chrome
    );
    spoke.position.set(Math.cos(a) * 0.14, Math.sin(a) * 0.14, 0);
    spoke.rotation.z = a;
    spinner.add(spoke);
  }

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.16, 18),
    chrome
  );
  hub.rotation.x = Math.PI / 2;
  spinner.add(hub);

  const caliper = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.16, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x941414, metalness: 0.35, roughness: 0.4 })
  );
  caliper.position.set(0.2, 0.06, z > 0 ? 0.11 : -0.11);
  knuckle.add(caliper);
}

function makeStudioReflectionScene(): import('three').Scene {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x10141a);

  const hemi = new THREE.HemisphereLight(0xf8fcff, 0x222733, 0.9);
  studio.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(4, 8, 3);
  studio.add(key);

  const fill = new THREE.DirectionalLight(0x9db6ff, 0.55);
  fill.position.set(-6, 3, -4);
  studio.add(fill);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(45, 45),
    new THREE.MeshStandardMaterial({ color: 0x0c0f13, roughness: 0.95, metalness: 0.0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2;
  studio.add(floor);

  const cardMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const topCard = new THREE.Mesh(new THREE.PlaneGeometry(11, 4.2), cardMat);
  topCard.position.set(0, 6.5, 0);
  topCard.rotation.x = Math.PI / 2;
  studio.add(topCard);

  const leftCard = new THREE.Mesh(new THREE.PlaneGeometry(7, 3), cardMat);
  leftCard.position.set(-7, 2.5, 0);
  leftCard.rotation.y = Math.PI / 2;
  studio.add(leftCard);

  const rightCard = new THREE.Mesh(new THREE.PlaneGeometry(7, 3), cardMat);
  rightCard.position.set(7, 2.5, 0);
  rightCard.rotation.y = -Math.PI / 2;
  studio.add(rightCard);

  const rearCard = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.6), cardMat);
  rearCard.position.set(0, 2.4, -7.5);
  studio.add(rearCard);

  return studio;
}

// ── Build car ────────────────────────────────────────────

(function buildCar(): void {
  const side = new THREE.Shape();
  side.moveTo(-1.94, 0.24);
  side.lineTo(1.82, 0.24);
  side.quadraticCurveTo(2.06, 0.24, 2.08, 0.47);
  side.lineTo(2.08, 0.62);
  side.quadraticCurveTo(2.04, 0.84, 1.84, 0.86);
  side.lineTo(1.08, 0.89);
  side.quadraticCurveTo(0.74, 0.91, 0.42, 1.3);
  side.quadraticCurveTo(0.2, 1.52, -0.1, 1.54);
  side.lineTo(-0.62, 1.54);
  side.quadraticCurveTo(-0.94, 1.5, -1.21, 1.13);
  side.lineTo(-1.52, 0.92);
  side.quadraticCurveTo(-1.86, 0.85, -2.0, 0.64);
  side.lineTo(-2.07, 0.44);
  side.quadraticCurveTo(-2.08, 0.24, -1.94, 0.24);

  const bodyGeo = new THREE.ExtrudeGeometry(side, {
    depth: 1.72,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.06,
    bevelSegments: 6,
    curveSegments: 20,
  });
  bodyGeo.translate(0, 0, -0.86);
  bodyGeo.computeVertexNormals();

  const body = new THREE.Mesh(bodyGeo, paint);
  body.castShadow = true;
  body.receiveShadow = true;
  carGroup.add(body);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.12, 1.26),
    paint
  );
  roof.position.set(-0.32, 1.39, 0);
  roof.castShadow = true;
  carGroup.add(roof);

  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(1.34, 0.08, 1.38),
    paint
  );
  hood.position.set(1.06, 0.86, 0);
  hood.rotation.z = -0.08;
  hood.castShadow = true;
  carGroup.add(hood);

  const trunk = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.1, 1.32),
    paint
  );
  trunk.position.set(-1.32, 0.92, 0);
  trunk.rotation.z = 0.08;
  trunk.castShadow = true;
  carGroup.add(trunk);

  for (const sideSign of [1, -1]) {
    const sideSkirt = new THREE.Mesh(
      new THREE.BoxGeometry(2.7, 0.1, 0.04),
      darkTrim
    );
    sideSkirt.position.set(-0.14, 0.34, sideSign * 0.9);
    carGroup.add(sideSkirt);

    const beltline = new THREE.Mesh(
      new THREE.BoxGeometry(2.35, 0.018, 0.018),
      chrome
    );
    beltline.position.set(-0.12, 1.02, sideSign * 0.91);
    carGroup.add(beltline);

    const mirrorArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.03, 0.1),
      darkTrim
    );
    mirrorArm.position.set(0.5, 1.03, sideSign * 0.93);
    carGroup.add(mirrorArm);

    const mirrorShell = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.08, 0.17),
      paint
    );
    mirrorShell.position.set(0.53, 1.04, sideSign * 1.0);
    carGroup.add(mirrorShell);

    const mirrorGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.08, 0.06),
      glass
    );
    mirrorGlass.position.set(0.58, 1.04, sideSign * 1.0);
    mirrorGlass.rotation.y = sideSign > 0 ? Math.PI / 2 : -Math.PI / 2;
    carGroup.add(mirrorGlass);
  }

  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.65, 1.12),
    glass
  );
  windshield.position.set(0.52, 1.05, 0);
  windshield.rotation.z = -0.95;
  carGroup.add(windshield);

  const rearGlass = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.5, 1.08),
    glass
  );
  rearGlass.position.set(-1.02, 1.12, 0);
  rearGlass.rotation.z = 0.72;
  carGroup.add(rearGlass);

  for (const sideSign of [1, -1]) {
    const sideGlass = new THREE.Mesh(
      new THREE.BoxGeometry(1.42, 0.4, 0.02),
      glass
    );
    sideGlass.position.set(-0.2, 1.13, sideSign * 0.9);
    carGroup.add(sideGlass);
  }

  const cabinFloor = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.12, 1.45),
    interiorPlasticMat
  );
  cabinFloor.position.set(-0.2, 0.62, 0);
  carGroup.add(cabinFloor);

  const dashboard = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.18, 1.1),
    interiorPlasticMat
  );
  dashboard.position.set(0.76, 0.95, 0);
  dashboard.rotation.z = -0.08;
  carGroup.add(dashboard);

  const centerConsole = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 0.16, 0.22),
    interiorPlasticMat
  );
  centerConsole.position.set(-0.12, 0.79, 0);
  carGroup.add(centerConsole);

  createSeat(0.07, 0.34, 0.73);
  createSeat(0.07, -0.34, 0.73);
  createSeat(-0.98, 0.34, 0.73);
  createSeat(-0.98, -0.34, 0.73);

  const steeringWheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.018, 12, 24),
    darkTrim
  );
  steeringWheel.position.set(0.42, 1.02, 0.31);
  steeringWheel.rotation.x = Math.PI / 2;
  steeringWheel.rotation.y = 0.3;
  carGroup.add(steeringWheel);

  const steeringCol = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.22, 12),
    interiorPlasticMat
  );
  steeringCol.position.set(0.52, 0.94, 0.23);
  steeringCol.rotation.z = -0.4;
  carGroup.add(steeringCol);

  createPanelLine(0.82, 0.25, 0.78, 0.92);
  createPanelLine(0.82, 0.25, 0.78, -0.92);
  createPanelLine(0.72, -0.78, 0.78, 0.92);
  createPanelLine(0.72, -0.78, 0.78, -0.92);

  createDoorHandle(0.14, 0.88, 0.92);
  createDoorHandle(0.14, 0.88, -0.92);
  createDoorHandle(-0.84, 0.88, 0.92);
  createDoorHandle(-0.84, 0.88, -0.92);

  const grilleGroup = new THREE.Group();
  const grilleBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.34, 0.76),
    grilleMat
  );
  grilleGroup.add(grilleBack);

  for (let i = 0; i < 7; i++) {
    const slat = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.02, 0.7),
      chrome
    );
    slat.position.set(0.02, -0.13 + i * 0.045, 0);
    grilleGroup.add(slat);
  }

  const badge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20),
    chrome
  );
  badge.rotation.z = Math.PI / 2;
  badge.position.set(0.04, 0.0, 0);
  grilleGroup.add(badge);

  grilleGroup.position.set(2.08, 0.62, 0);
  carGroup.add(grilleGroup);

  const lowerIntake = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.2, 1.02),
    grilleMat
  );
  lowerIntake.position.set(2.07, 0.36, 0);
  carGroup.add(lowerIntake);

  for (let i = 0; i < 6; i++) {
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.16, 0.018),
      darkTrim
    );
    fin.position.set(2.1, 0.36, -0.42 + i * 0.17);
    carGroup.add(fin);
  }

  const splitter = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.02, 1.2),
    darkTrim
  );
  splitter.position.set(2.01, 0.25, 0);
  carGroup.add(splitter);

  for (const sideSign of [1, -1]) {
    const headlightGroup = new THREE.Group();

    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.15, 0.26),
      darkTrim
    );
    headlightGroup.add(housing);

    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.05, 16),
      headlightCoreMat
    );
    core.rotation.z = Math.PI / 2;
    core.position.x = 0.02;
    headlightGroup.add(core);

    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      headlightLensMat
    );
    lens.rotation.z = Math.PI / 2;
    lens.position.x = 0.05;
    headlightGroup.add(lens);

    headlightGroup.position.set(2.02, 0.74, sideSign * 0.56);
    carGroup.add(headlightGroup);

    const taillight = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.14, 0.32),
      taillightMat
    );
    taillight.position.set(-2.03, 0.73, sideSign * 0.58);
    carGroup.add(taillight);
  }

  const frontPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.12, 0.36),
    plateMat
  );
  frontPlate.position.set(2.1, 0.42, 0);
  carGroup.add(frontPlate);

  const rearPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.12, 0.36),
    plateMat
  );
  rearPlate.position.set(-2.08, 0.4, 0);
  carGroup.add(rearPlate);

  for (const sideSign of [1, -1]) {
    const fArch = new THREE.Mesh(
      new THREE.TorusGeometry(0.49, 0.03, 10, 22, Math.PI),
      darkTrim
    );
    fArch.position.set(1.25, 0.5, sideSign * 0.84);
    fArch.rotation.y = sideSign > 0 ? Math.PI / 2 : -Math.PI / 2;
    carGroup.add(fArch);

    const rArch = new THREE.Mesh(
      new THREE.TorusGeometry(0.49, 0.03, 10, 22, Math.PI),
      darkTrim
    );
    rArch.position.set(-1.26, 0.5, sideSign * 0.84);
    rArch.rotation.y = sideSign > 0 ? Math.PI / 2 : -Math.PI / 2;
    carGroup.add(rArch);
  }

  createWheel(1.24, 0.86, true);
  createWheel(1.24, -0.86, true);
  createWheel(-1.26, 0.86, false);
  createWheel(-1.26, -0.86, false);

  for (const sideSign of [1, -1]) {
    const exhaust = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.04, 0.18, 12),
      chrome
    );
    exhaust.rotation.z = Math.PI / 2;
    exhaust.position.set(-2.14, 0.3, sideSign * 0.35);
    carGroup.add(exhaust);
  }

  const underShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.1, 1.9),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    })
  );
  underShadow.rotation.x = -Math.PI / 2;
  underShadow.position.y = 0.02;
  carGroup.add(underShadow);
})();

carGroup.scale.setScalar(0.72);
carGroup.position.copy(carPos);

// ── Environment map for reflections ──────────────────────

export function initCarEnvMap(): void {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();

  const studioScene = makeStudioReflectionScene();

  if (carEnvRT) {
    carEnvRT.dispose();
    carEnvRT = null;
  }

  carEnvRT = pmrem.fromScene(studioScene, 0.015, 0.5, 50);
  const envMap = carEnvRT.texture;

  for (const target of envTargets) {
    target.mat.envMap = envMap;
    target.mat.envMapIntensity = target.intensity;
    target.mat.needsUpdate = true;
  }

  pmrem.dispose();
}

// ── Update ───────────────────────────────────────────────

export function updateCar(dt: number): void {
  if (gameState.inCar) {
    if (keys['ArrowLeft']) gameState.carFacing += CAR_TURN * dt;
    if (keys['ArrowRight']) gameState.carFacing -= CAR_TURN * dt;

    let speed = 0;
    if (keys['ArrowUp']) speed = CAR_SPD;
    if (keys['ArrowDown']) speed = -CAR_SPD * 0.5;

    const nx = carPos.x - Math.sin(gameState.carFacing) * speed * dt;
    const nz = carPos.z - Math.cos(gameState.carFacing) * speed * dt;

    // Check collisions for front and rear of car (car is about 2m long in world units)
    const fwdX = -Math.sin(gameState.carFacing);
    const fwdZ = -Math.cos(gameState.carFacing);
    const frontX = nx + fwdX * 1.2, frontZ = nz + fwdZ * 1.2;
    const rearX  = nx - fwdX * 1.2, rearZ  = nz - fwdZ * 1.2;

    if (!checkWorldCollision(frontX, frontZ, 0.7) && !checkWorldCollision(rearX, rearZ, 0.7)) {
      carPos.x = nx;
      carPos.z = nz;
    }

    player.pos.copy(carPos);
    player.facing = gameState.carFacing;
  }

  carGroup.position.set(carPos.x, 0, carPos.z);
  // Front of the model is +X; movement at facing=0 is -Z.
  carGroup.rotation.y = gameState.carFacing + Math.PI / 2;

  const moveDir = keys['ArrowUp'] ? 1 : (keys['ArrowDown'] ? -1 : 0);
  if (gameState.inCar && moveDir !== 0) {
    const spinStep = dt * 10 * moveDir;
    for (const spinner of wheelSpinners) spinner.rotation.z += spinStep;
  }

  const steerInput = (keys['ArrowLeft'] ? 1 : 0) - (keys['ArrowRight'] ? 1 : 0);
  const targetSteer = steerInput * 0.35;
  for (const knuckle of steerKnuckles) {
    knuckle.rotation.y += (targetSteer - knuckle.rotation.y) * 0.2;
  }

  taillightMat.emissiveIntensity = keys['ArrowDown'] && gameState.inCar ? 1.9 : 1.0;
}
