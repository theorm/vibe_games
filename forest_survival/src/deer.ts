// Deer mesh, state object, and AI update
declare const THREE: typeof import('three');

import { scene } from './scene.js';
import { FOREST_R, SAFE_R, DEER_SPD, DEER_CHASE_R, DEER_ATK_R, DEER_ATK_DMG, DEER_ATK_INT } from './constants.js';
import { gameState, deforestedCells } from './state.js';
import { deerCanEnter, dist2D, cellKey } from './world.js';
import { carPos } from './car.js';
import { player } from './player.js';
import { sfxDeerRoar, sfxDeerStep } from './audio.js';
import { flashColor } from './ui.js';

export const deerGroup = new THREE.Group();
scene.add(deerGroup);

export const deer = {
  pos: new THREE.Vector3(0, 0, FOREST_R * 0.6),
  facing: 0,
  hp: 100,
  state: 'wander' as string,
  wanderTarget: new THREE.Vector3(),
  wanderTimer: 0,
  legPhase: 0,
  lastStepPhase: 0,
  attackTimer: 0,
  alive: true,
};
deerGroup.position.copy(deer.pos);

export function buildDeer(): void {
  deerGroup.clear();
  const brown = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
  const dkBrn = new THREE.MeshLambertMaterial({ color: 0x5a3010 });
  const tan   = new THREE.MeshLambertMaterial({ color: 0xd2a06a });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.5), brown);
  body.position.y = 0.8; body.castShadow = true; deerGroup.add(body);

  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.3), brown);
  neck.position.set(0.45, 1.1, 0); neck.rotation.z = -0.4; deerGroup.add(neck);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.32), brown);
  head.position.set(0.78, 1.35, 0); head.castShadow = true; deerGroup.add(head);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.24), tan);
  snout.position.set(0.96, 1.26, 0); deerGroup.add(snout);

  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.07, 0.04),
      new THREE.MeshBasicMaterial({ color: 0xff2200 })
    );
    eye.position.set(0.85, 1.42, s * 0.14); deerGroup.add(eye);
  }

  for (const s of [-1, 1]) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.4, 4), dkBrn);
    base.position.set(0.72, 1.62, s * 0.12); base.rotation.z = s * 0.25; deerGroup.add(base);
    for (let b = 0; b < 2; b++) {
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.28, 4), dkBrn);
      br.position.set(0.72 + s * 0.08 + b * 0.1 * s, 1.88 + b * 0.1, s * 0.2);
      br.rotation.z = s * (0.7 + b * 0.3); deerGroup.add(br);
    }
  }

  for (const [lx, lz] of [[0.3, 0.25], [0.3, -0.25], [-0.3, 0.25], [-0.3, -0.25]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.16), brown);
    leg.position.set(lx, 0.3, lz); leg.castShadow = true; deerGroup.add(leg);
  }

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.1), tan);
  tail.position.set(-0.54, 0.95, 0); deerGroup.add(tail);
}

export function updateDeer(dt: number): void {
  if (!deer.alive || gameState.gameOver || gameState.gameWon) return;

  const ap = gameState.inCar ? carPos : player.pos;
  const dx = deer.pos.x - ap.x, dz = deer.pos.z - ap.z;
  const d = Math.sqrt(dx * dx + dz * dz);

  if (dist2D(ap.x, ap.z, 0, 0) < SAFE_R && !gameState.inCar) {
    deer.state = 'wander';
  } else if (d < DEER_CHASE_R) {
    deer.state = 'chase';
  } else {
    deer.state = 'wander';
  }

  // Mirror for audio module (avoids circular import)
  gameState.deerState = deer.state;
  gameState.deerAlive = deer.alive;
  gameState.deerPos.x = deer.pos.x;
  gameState.deerPos.z = deer.pos.z;

  let mx = 0, mz = 0;
  if (deer.state === 'chase') {
    const len = d || 1;
    mx = -(dx / len) * DEER_SPD; mz = -(dz / len) * DEER_SPD;
    deer.facing = Math.atan2(-mx, -mz);
    deer.attackTimer -= dt;

    if (d < DEER_ATK_R && deer.attackTimer <= 0 && !gameState.inCar) {
      deer.attackTimer = DEER_ATK_INT;
      if (player.invincTimer <= 0) {
        gameState.playerHP -= DEER_ATK_DMG;
        player.invincTimer = 0.5;
        sfxDeerRoar(deer.pos);
        flashColor('rgba(255,0,0,0.4)');
        if (gameState.playerHP <= 0) {
          gameState.playerHP = 0;
          gameState.onDeath?.('deer');
        }
      }
    }
  } else {
    deer.wanderTimer -= dt;
    if (deer.wanderTimer <= 0) {
      deer.wanderTimer = 2 + Math.random() * 3;
      const a = Math.random() * Math.PI * 2;
      const r = SAFE_R + 3 + Math.random() * (FOREST_R - SAFE_R - 5);
      deer.wanderTarget.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
    const tx = deer.wanderTarget.x - deer.pos.x, tz = deer.wanderTarget.z - deer.pos.z;
    const tl = Math.sqrt(tx * tx + tz * tz) || 1;
    if (tl > 1) { mx = (tx / tl) * DEER_SPD * 0.5; mz = (tz / tl) * DEER_SPD * 0.5; deer.facing = Math.atan2(-mx, -mz); }
  }

  const nx = deer.pos.x + mx * dt, nz = deer.pos.z + mz * dt;
  if (deerCanEnter(nx, nz) && !deforestedCells.has(cellKey(nx, nz))) {
    deer.pos.x = nx; deer.pos.z = nz;
  } else {
    deer.wanderTimer = 0;
  }

  deer.legPhase += dt * 4;
  
  // Footstep triggers based on leg phase (four legs, so twice per cycle)
  if (Math.abs(mx) > 0.01 || Math.abs(mz) > 0.01) {
    const stepFreq = Math.PI;
    if (Math.floor(deer.legPhase / stepFreq) !== Math.floor(deer.lastStepPhase / stepFreq)) {
      sfxDeerStep(deer.pos);
    }
  }
  deer.lastStepPhase = deer.legPhase;

  deerGroup.position.set(deer.pos.x, Math.abs(Math.sin(deer.legPhase * 0.5)) * 0.05, deer.pos.z);
  deerGroup.rotation.y = deer.facing;
  deerGroup.rotation.z = Math.sin(deer.legPhase) * 0.15;
  deerGroup.children.forEach((c: any, i: number) => {
    if (i >= 12 && i <= 15) c.position.y = 0.3 + Math.sin(deer.legPhase + i * 1.5) * 0.08;
  });
}
