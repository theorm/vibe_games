// Alien and zombie enemies: spawning and AI update
declare const THREE: typeof import('three');

import { scene } from './scene.js';
import { FOREST_R } from './constants.js';
import { gameState, aliens, zombies, EnemyData } from './state.js';
import { carPos } from './car.js';
import { player } from './player.js';
import { dist2D } from './world.js';
import { flashColor, setActionHint, showEventBanner } from './ui.js';

export function spawnAliens(): void {
  showEventBanner('👽 ALIENS LANDING!', 5000, '#0f0');
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    const gMat = new THREE.MeshLambertMaterial({ color: 0x44dd44 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), gMat);
    body.position.y = 0.7; g.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), new THREE.MeshLambertMaterial({ color: 0x55ee55 }));
    head.position.y = 1.2; g.add(head);

    for (const ex of [-0.13, 0.13]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
      eye.position.set(ex, 1.28, 0.22); g.add(eye);
    }
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), gMat);
      arm.position.set(s * 0.45, 0.75, 0); g.add(arm);
    }

    const ufo = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.14, 16), new THREE.MeshLambertMaterial({ color: 0xccccff }));
    ufo.position.y = 2.0; g.add(ufo);

    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), new THREE.MeshBasicMaterial({ color: 0x88aaff, transparent: true, opacity: 0.7 }));
    dome.position.y = 2.2; g.add(dome);

    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.3, 1.8, 8), new THREE.MeshBasicMaterial({ color: 0x88ff88, transparent: true, opacity: 0.3 }));
    beam.position.y = 1.1; g.add(beam);

    const angle = Math.random() * Math.PI * 2;
    const r = FOREST_R + 10 + Math.random() * 25;
    const pos = new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    g.position.copy(pos); scene.add(g);

    aliens.push({ mesh: g, pos: pos.clone(), hp: 2, alive: true, speed: 3 + Math.random() * 2, attackTimer: 1 + Math.random() });
  }
}

export function spawnZombies(): void {
  showEventBanner('🧟 ZOMBIES FROM THE LAB!', 6000, '#f80');
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    const zMat  = new THREE.MeshLambertMaterial({ color: 0x5a8a3a });
    const zSkin = new THREE.MeshLambertMaterial({ color: 0x7aaa5a });
    const zEye  = new THREE.MeshBasicMaterial({ color: 0xff2200 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.65, 0.28), zMat);
    body.position.y = 0.83; g.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), zSkin);
    head.position.y = 1.42; g.add(head);

    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.04), zEye);
      eye.position.set(s * 0.11, 1.45, 0.2); g.add(eye);
    }
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.45, 0.16), zMat);
      arm.position.set(s * 0.33, 1.0, 0.22); arm.rotation.x = -0.7; g.add(arm);
    }
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.48, 0.18), zMat);
      leg.position.set(s * 0.13, 0.24, 0); g.add(leg);
    }

    const pos = new THREE.Vector3(125 + Math.random() * 20, 0, (Math.random() - 0.5) * 18);
    g.position.copy(pos); scene.add(g);

    zombies.push({ mesh: g, pos: pos.clone(), hp: 2, alive: true, speed: 2 + Math.random() * 1.5, attackTimer: 1.5 + Math.random(), legPhase: Math.random() * Math.PI * 2 });
  }
}

export function updateEnemies(dt: number): void {
  const ap = gameState.inCar ? carPos : player.pos;

  for (const e of [...aliens, ...zombies]) {
    if (!e.alive) continue;

    const dx = ap.x - e.pos.x, dz = ap.z - e.pos.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    e.pos.x += (dx / d) * e.speed * dt;
    e.pos.z += (dz / d) * e.speed * dt;
    e.mesh.position.set(e.pos.x, 0, e.pos.z);
    e.mesh.rotation.y = Math.atan2(dx, dz);

    if ('legPhase' in e && e.legPhase !== undefined) {
      e.legPhase += dt * 3;
      e.mesh.rotation.z = Math.sin(e.legPhase) * 0.12;
      e.mesh.position.y = Math.abs(Math.sin(e.legPhase * 0.5)) * 0.04;
    } else {
      e.mesh.position.y = 0.1 + Math.sin(Date.now() * 0.003 + e.pos.x) * 0.15;
    }

    e.attackTimer -= dt;
    if (d < 1.8 && e.attackTimer <= 0 && !gameState.inCar) {
      e.attackTimer = 2.0;
      if (player.invincTimer <= 0) {
        const isAlien = aliens.includes(e);
        const dmg = isAlien ? 15 : 10;
        gameState.playerHP -= dmg;
        player.invincTimer = 0.4;
        flashColor(isAlien ? 'rgba(0,255,0,0.35)' : 'rgba(200,140,0,0.4)');
        if (gameState.playerHP <= 0) {
          gameState.playerHP = 0;
          gameState.onDeath?.(isAlien ? 'alien' : 'zombie');
        }
      }
    }

    // Car kills enemies on contact
    if (gameState.inCar && dist2D(e.pos.x, e.pos.z, carPos.x, carPos.z) < 2.5) {
      e.alive = false; scene.remove(e.mesh);
      setActionHint('💥 Squashed!');
    }

    if (dist2D(e.pos.x, e.pos.z, 0, 0) > 210) { e.alive = false; scene.remove(e.mesh); }
  }
}
