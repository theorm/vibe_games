// Cage/trap lifecycle: placement, deer capture, car cargo, and planet drop visuals.
declare const THREE: typeof import('three');

import { scene } from './scene.js';
import { gameState } from './state.js';
import { deer, deerGroup } from './deer.js';
import { carPos } from './car.js';
import { dist2D } from './world.js';
import { showMessage } from './ui.js';

const CAGE_CAPTURE_R = 1.7;

let trapGroup: import('three').Group | null = null;
let trapPos: import('three').Vector3 | null = null;
let planetDropGroup: import('three').Group | null = null;

const carCargoGroup = new THREE.Group();
carCargoGroup.visible = false;
scene.add(carCargoGroup);

function makeCageMesh(hasDeerInside: boolean): import('three').Group {
  const g = new THREE.Group();
  const barMat = new THREE.MeshStandardMaterial({ color: 0x9aa4b1, metalness: 0.7, roughness: 0.35 });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x3d2d1e, metalness: 0.2, roughness: 0.8 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 1.5), baseMat);
  base.position.y = 0.06;
  base.castShadow = true;
  g.add(base);

  const h = 1.3;
  for (const x of [-0.65, -0.32, 0, 0.32, 0.65]) {
    for (const z of [-0.65, 0.65]) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, h, 8), barMat);
      bar.position.set(x, h * 0.5 + 0.12, z);
      bar.castShadow = true;
      g.add(bar);
    }
  }
  for (const z of [-0.65, -0.32, 0, 0.32, 0.65]) {
    for (const x of [-0.65, 0.65]) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, h, 8), barMat);
      bar.position.set(x, h * 0.5 + 0.12, z);
      bar.castShadow = true;
      g.add(bar);
    }
  }

  const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.5), barMat);
  top.position.y = h + 0.16;
  top.castShadow = true;
  g.add(top);

  if (hasDeerInside) {
    const deerMass = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.45, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x70421f, roughness: 0.9 })
    );
    deerMass.position.set(0, 0.35, 0);
    deerMass.castShadow = true;
    g.add(deerMass);
  } else {
    const bait = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.28, 8),
      new THREE.MeshStandardMaterial({ color: 0xffcc55, roughness: 0.65 })
    );
    bait.position.set(0, 0.22, 0);
    bait.rotation.x = Math.PI;
    g.add(bait);
  }

  return g;
}

function rebuildTrapVisual(hasDeerInside: boolean): void {
  if (!trapGroup) return;
  trapGroup.clear();
  const mesh = makeCageMesh(hasDeerInside);
  trapGroup.add(mesh);
}

export function placeCageTrap(x: number, z: number): boolean {
  if (!gameState.hasCage || gameState.cagePlaced || gameState.deerCaptured) return false;

  if (!trapGroup) {
    trapGroup = new THREE.Group();
    scene.add(trapGroup);
  }
  trapPos = new THREE.Vector3(x, 0, z);
  trapGroup.position.set(x, 0, z);
  rebuildTrapVisual(false);

  gameState.cagePlaced = true;
  return true;
}

export function getCageWorldPos(): import('three').Vector3 | null {
  if (!trapPos || !gameState.deerCaptured || gameState.cageLoadedInCar) return null;
  return trapPos;
}

export function loadCageIntoCar(): boolean {
  if (!gameState.deerCaptured || gameState.cageLoadedInCar) return false;
  gameState.cageLoadedInCar = true;
  gameState.cagePlaced = false;
  if (trapGroup) trapGroup.visible = false;
  carCargoGroup.clear();
  carCargoGroup.add(makeCageMesh(true));
  carCargoGroup.visible = true;
  return true;
}

export function launchToPlanet(): void {
  gameState.rocketLaunched = true;
  gameState.onPlanet = true;
  carCargoGroup.visible = false;
  showMessage(
    '🚀 <strong>LAUNCH!</strong><br><br>You blasted off with the caged deer.<br>You have landed on a distant planet.<br><br>Bring the cage out of the rocket.',
    5200
  );
}

export function unloadCageOnPlanet(x: number, z: number): void {
  if (planetDropGroup) scene.remove(planetDropGroup);
  planetDropGroup = makeCageMesh(true);
  planetDropGroup.position.set(x, 0, z);
  scene.add(planetDropGroup);
  gameState.cageLoadedInCar = false;
  carCargoGroup.visible = false;
}

export function updateCage(): void {
  if (gameState.cageLoadedInCar) {
    carCargoGroup.position.set(carPos.x, 0.45, carPos.z);
    carCargoGroup.rotation.y = gameState.carFacing;
  }

  if (!gameState.cagePlaced || gameState.deerCaptured || !trapPos || !deer.alive) return;
  if (dist2D(deer.pos.x, deer.pos.z, trapPos.x, trapPos.z) > CAGE_CAPTURE_R) return;

  gameState.deerCaptured = true;
  gameState.cagePlaced = true;
  deer.alive = false;
  deerGroup.visible = false;
  gameState.deerAlive = false;
  gameState.stage = Math.max(gameState.stage, 5);
  rebuildTrapVisual(true);
  showMessage('🦌 <strong>DEER CAPTURED!</strong><br>The bait trap worked. Bring the car next to the cage and load it.', 4200);
}
