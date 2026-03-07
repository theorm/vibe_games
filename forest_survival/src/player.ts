// Player mesh, state object, update logic, and sword attachment
declare const THREE: typeof import('three');

import { scene } from './scene.js';
import { FOREST_R, PLAYER_SPD } from './constants.js';
import { gameState, keys } from './state.js';
import { checkTreeCollision, dist2D } from './world.js';

export const playerGroup = new THREE.Group();
scene.add(playerGroup);

export const player = {
  pos: new THREE.Vector3(FOREST_R + 2, 0, 0),
  facing: Math.PI,
  invincTimer: 0,
};
playerGroup.position.copy(player.pos);

export function buildPlayer(): void {
  playerGroup.clear();
  const skin  = new THREE.MeshLambertMaterial({ color: 0xf5d0a9 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x3a8cca });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a4a8a });
  const hat1  = new THREE.MeshLambertMaterial({ color: 0x6b3d1a });
  const hat2  = new THREE.MeshLambertMaterial({ color: 0x5a3014 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), shirt);
  body.position.y = 0.85; body.castShadow = true; playerGroup.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skin);
  head.position.y = 1.45; head.castShadow = true; playerGroup.add(head);

  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.7), hat1);
  brim.position.y = 1.65; playerGroup.add(brim);

  const hatTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.38), hat2);
  hatTop.position.y = 1.78; hatTop.rotation.z = 0.18; playerGroup.add(hatTop);

  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.2), pants);
    leg.position.set(s * 0.15, 0.25, 0); leg.castShadow = true; playerGroup.add(leg);
  }
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), shirt);
    arm.position.set(s * 0.35, 0.85, 0); arm.castShadow = true; playerGroup.add(arm);
  }

  const axeH = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.7, 0.07),
    new THREE.MeshLambertMaterial({ color: 0x6b4423 })
  );
  axeH.position.set(0.55, 0.75, 0.15); playerGroup.add(axeH);

  const axeB = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.22, 0.08),
    new THREE.MeshLambertMaterial({ color: 0xaaaaaa })
  );
  axeB.position.set(0.62, 1.1, 0.15); playerGroup.add(axeB);
}

export function addSwordToPlayer(): void {
  const toRemove: any[] = [];
  playerGroup.children.forEach((c: any, i: number) => { if (i >= 8) toRemove.push(c); });
  toRemove.forEach(c => playerGroup.remove(c));

  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.7, 0.04),
    new THREE.MeshLambertMaterial({ color: 0xddddff })
  );
  blade.position.set(0.55, 1.05, 0.1); playerGroup.add(blade);

  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.06, 0.06),
    new THREE.MeshLambertMaterial({ color: 0xd4a017 })
  );
  guard.position.set(0.55, 0.72, 0.1); playerGroup.add(guard);

  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.28, 0.07),
    new THREE.MeshLambertMaterial({ color: 0x5a3010 })
  );
  grip.position.set(0.55, 0.56, 0.1); playerGroup.add(grip);
}

export function updatePlayer(dt: number): void {
  if (gameState.gameOver || gameState.gameWon || gameState.inCar) return;

  if (keys['ArrowLeft'])  player.facing += 1.8 * dt;
  if (keys['ArrowRight']) player.facing -= 1.8 * dt;

  let mx = 0, mz = 0;
  if (keys['ArrowUp'])   { mx = -Math.sin(player.facing) * PLAYER_SPD; mz = -Math.cos(player.facing) * PLAYER_SPD; }
  if (keys['ArrowDown']) { mx =  Math.sin(player.facing) * PLAYER_SPD * 0.5; mz =  Math.cos(player.facing) * PLAYER_SPD * 0.5; }

  const nx = player.pos.x + mx * dt, nz = player.pos.z + mz * dt;
  if (dist2D(nx, nz, 0, 0) < FOREST_R + 10) {
    let blocked = checkTreeCollision(nx, nz, 0.4);
    if (!blocked && gameState.workbenchPos && dist2D(nx, nz, gameState.workbenchPos.x, gameState.workbenchPos.z) < 0.9)
      blocked = true;
    if (!blocked) { player.pos.x = nx; player.pos.z = nz; }
  }

  const moving = mx !== 0 || mz !== 0;
  playerGroup.position.y = moving ? Math.abs(Math.sin(Date.now() * 0.007)) * 0.08 : 0;
  playerGroup.position.x = player.pos.x;
  playerGroup.position.z = player.pos.z;
  playerGroup.rotation.y = player.facing + Math.PI;

  if (player.invincTimer > 0) {
    player.invincTimer -= dt;
    playerGroup.visible = Math.sin(Date.now() * 0.025) > 0;
  } else {
    playerGroup.visible = true;
  }

  if (gameState.playerAttackTimer > 0) gameState.playerAttackTimer -= dt;
}
