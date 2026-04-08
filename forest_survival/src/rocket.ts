// Flyable rocket transit: loading cargo, piloting through space, and landing on a different planet.
declare const THREE: typeof import('three');

import { renderer, scene } from './scene.js';
import { gameState, keys } from './state.js';
import { ROCKET_THRUST, ROCKET_TURN, ROCKET_PITCH } from './constants.js';
import { player, playerGroup } from './player.js';
import { showMessage } from './ui.js';

const launchPadPos = new THREE.Vector3(0, 0, 80);
const planetLandingPos = new THREE.Vector3(gameState.planetPos.x, 0, gameState.planetPos.z);

const spaceFlightGroup = new THREE.Group();
spaceFlightGroup.visible = false;
scene.add(spaceFlightGroup);

const spaceBackdrop = new THREE.Group();
spaceBackdrop.visible = false;
scene.add(spaceBackdrop);

const planetWorldGroup = new THREE.Group();
planetWorldGroup.visible = false;
scene.add(planetWorldGroup);

const landedRocketGroup = new THREE.Group();
landedRocketGroup.visible = false;
scene.add(landedRocketGroup);

const rocketPos = new THREE.Vector3(launchPadPos.x, 8, launchPadPos.z);
const rocketVel = new THREE.Vector3();
const destinationPos = new THREE.Vector3(0, 48, 560);
let rocketYaw = Math.PI;
let rocketPitch = 0;

function buildSimpleRocket(scale = 1): import('three').Group {
  const g = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0xeef2f8, metalness: 0.25, roughness: 0.45 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x293243, metalness: 0.8, roughness: 0.28 });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.9 * scale, 0.9 * scale, 6 * scale, 14), hull);
  core.position.y = 3 * scale;
  core.castShadow = true;
  g.add(core);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9 * scale, 1.8 * scale, 14), hull);
  cone.position.y = 6.9 * scale;
  cone.castShadow = true;
  g.add(cone);
  for (const side of [-1, 1]) {
    const booster = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * scale, 0.35 * scale, 4 * scale, 12), hull);
    booster.position.set(side * 1.15 * scale, 2.1 * scale, 0);
    booster.castShadow = true;
    g.add(booster);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08 * scale, 1.1 * scale, 0.7 * scale), trim);
    fin.position.set(Math.cos(a) * 1.0 * scale, 0.7 * scale, Math.sin(a) * 1.0 * scale);
    fin.rotation.y = -a;
    fin.castShadow = true;
    g.add(fin);
  }
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * scale, 0.32 * scale, 0.42 * scale, 12), trim);
  nozzle.position.y = -0.12 * scale;
  g.add(nozzle);
  return g;
}

function buildSpaceBackdrop(): void {
  const stars = new THREE.Group();
  const starMat = new THREE.MeshBasicMaterial({ color: 0xe8f6ff });
  for (let i = 0; i < 220; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.35 + Math.random() * 0.35, 6, 6), starMat);
    s.position.set((Math.random() - 0.5) * 640, 30 + Math.random() * 180, Math.random() * 700);
    stars.add(s);
  }
  spaceBackdrop.add(stars);

  const targetPlanet = new THREE.Mesh(
    new THREE.SphereGeometry(16, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0x6ac4ff, emissive: 0x163860, emissiveIntensity: 0.55, roughness: 0.9 })
  );
  targetPlanet.position.copy(destinationPos);
  spaceBackdrop.add(targetPlanet);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(24, 1.2, 12, 64),
    new THREE.MeshBasicMaterial({ color: 0xa9defd })
  );
  ring.rotation.x = 1.05;
  ring.position.copy(destinationPos);
  spaceBackdrop.add(ring);
}

function buildPlanetWorld(): void {
  const terrain = new THREE.Mesh(
    new THREE.CircleGeometry(36, 40),
    new THREE.MeshStandardMaterial({ color: 0x9e7f45, roughness: 0.95, metalness: 0.03 })
  );
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.copy(planetLandingPos);
  terrain.position.y = 0.05;
  terrain.receiveShadow = true;
  planetWorldGroup.add(terrain);

  const craterRing = new THREE.Mesh(
    new THREE.RingGeometry(10, 16, 48),
    new THREE.MeshBasicMaterial({ color: 0x6a4f2d, side: THREE.DoubleSide })
  );
  craterRing.rotation.x = -Math.PI / 2;
  craterRing.position.set(planetLandingPos.x + 12, 0.08, planetLandingPos.z + 8);
  planetWorldGroup.add(craterRing);

  for (let i = 0; i < 12; i++) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.4 + Math.random() * 1.2, 0),
      new THREE.MeshStandardMaterial({ color: 0x5e4832, roughness: 0.9, metalness: 0.06 })
    );
    const a = Math.random() * Math.PI * 2;
    const r = 7 + Math.random() * 24;
    rock.position.set(
      planetLandingPos.x + Math.cos(a) * r,
      0.8 + Math.random() * 0.9,
      planetLandingPos.z + Math.sin(a) * r
    );
    rock.castShadow = true;
    planetWorldGroup.add(rock);
  }
}

export function initRocketWorlds(): void {
  spaceFlightGroup.add(buildSimpleRocket(1.2));
  buildSpaceBackdrop();
  buildPlanetWorld();

  landedRocketGroup.add(buildSimpleRocket(0.9));
  landedRocketGroup.position.set(planetLandingPos.x, 0, planetLandingPos.z);
  landedRocketGroup.rotation.y = Math.PI;
}

export function getRocketGroundPos(): import('three').Vector3 {
  return gameState.onPlanet ? planetLandingPos : launchPadPos;
}

export function getRocketFlightPose(): { pos: import('three').Vector3; yaw: number; pitch: number } {
  return { pos: rocketPos, yaw: rocketYaw, pitch: rocketPitch };
}

export function getRocketDistanceToDestination(): number {
  return rocketPos.distanceTo(destinationPos);
}

export function loadCageIntoRocket(): boolean {
  if (!gameState.cageLoadedInCar || gameState.cageLoadedInRocket) return false;
  gameState.cageLoadedInCar = false;
  gameState.cageLoadedInRocket = true;
  gameState.stage = Math.max(gameState.stage, 5);
  showMessage('🚀 <strong>CAGE LOADED INTO ROCKET</strong><br>Board the rocket and fly it to another planet.', 4200);
  return true;
}

export function beginRocketFlight(): boolean {
  if (!gameState.cageLoadedInRocket || gameState.rocketLaunched || gameState.onPlanet) return false;

  gameState.inCar = false;
  gameState.driverView = false;
  gameState.inRocket = true;
  gameState.rocketLaunched = true;
  gameState.onPlanet = false;

  playerGroup.visible = false;

  rocketPos.set(launchPadPos.x, 10, launchPadPos.z);
  rocketVel.set(0, 0, 0);
  rocketYaw = Math.PI;
  rocketPitch = 0.1;
  gameState.rocketFlightPos.x = rocketPos.x;
  gameState.rocketFlightPos.z = rocketPos.z;
  gameState.rocketFlightDest.x = destinationPos.x;
  gameState.rocketFlightDest.z = destinationPos.z;

  spaceFlightGroup.visible = true;
  spaceBackdrop.visible = true;
  landedRocketGroup.visible = false;
  planetWorldGroup.visible = false;

  showMessage('🚀 <strong>ROCKET FLIGHT ACTIVE</strong><br>Use ← → to steer, ↑ to thrust, ↓ to pitch down.<br>Fly to the glowing planet marker.', 6000);
  return true;
}

function arriveAtPlanet(): void {
  gameState.inRocket = false;
  gameState.onPlanet = true;

  spaceFlightGroup.visible = false;
  spaceBackdrop.visible = false;
  planetWorldGroup.visible = true;
  landedRocketGroup.visible = true;

  player.pos.set(planetLandingPos.x + 4.6, 0, planetLandingPos.z + 1.2);
  player.facing = Math.PI;
  playerGroup.visible = true;
  showMessage('🪐 <strong>PLANETFALL COMPLETE</strong><br>You reached a different world.<br>Go to the landed rocket and unload the deer cage.', 5500);
}

export function unloadCageFromRocket(): boolean {
  if (!gameState.onPlanet || !gameState.cageLoadedInRocket) return false;
  gameState.cageLoadedInRocket = false;
  return true;
}

export function updateRocketFlight(dt: number): void {
  if (!gameState.inRocket) return;

  if (keys['ArrowLeft']) rocketYaw += ROCKET_TURN * dt;
  if (keys['ArrowRight']) rocketYaw -= ROCKET_TURN * dt;
  if (keys['ArrowUp']) rocketPitch = Math.min(0.55, rocketPitch + ROCKET_PITCH * dt * 0.4);
  if (keys['ArrowDown']) rocketPitch = Math.max(-0.35, rocketPitch - ROCKET_PITCH * dt * 0.4);

  const thrust = keys['ArrowUp'] ? ROCKET_THRUST : ROCKET_THRUST * 0.28;
  const drag = Math.exp(-dt * 0.55);
  rocketVel.multiplyScalar(drag);
  const cosP = Math.cos(rocketPitch);
  const fwd = new THREE.Vector3(
    -Math.sin(rocketYaw) * cosP,
    Math.sin(rocketPitch),
    -Math.cos(rocketYaw) * cosP
  );
  rocketVel.addScaledVector(fwd, thrust * dt);
  rocketPos.addScaledVector(rocketVel, dt);
  gameState.rocketFlightPos.x = rocketPos.x;
  gameState.rocketFlightPos.z = rocketPos.z;

  if (rocketPos.y < 8) {
    rocketPos.y = 8;
    if (rocketVel.y < 0) rocketVel.y *= -0.2;
  }

  spaceFlightGroup.position.copy(rocketPos);
  spaceFlightGroup.rotation.set(-rocketPitch, rocketYaw + Math.PI, 0);

  if (rocketPos.distanceTo(destinationPos) < 28) {
    arriveAtPlanet();
  }
}

export function updateRocketWorldAtmosphere(): void {
  if (gameState.inRocket) {
    renderer.setClearColor(0x02040c);
    scene.fog.color.setHex(0x02040c);
    scene.fog.near = 260;
    scene.fog.far = 920;
    return;
  }
  if (gameState.onPlanet) {
    renderer.setClearColor(0xa06c3a);
    scene.fog.color.setHex(0xa06c3a);
    scene.fog.near = 25;
    scene.fog.far = 145;
    return;
  }
}
