// Ground, trees, mines, world generation, and spatial helpers
declare const THREE: typeof import('three');

import { scene } from './scene.js';
import { FOREST_R, SAFE_R, TREE_COUNT, MINE_COUNT } from './constants.js';
import { gameState, trees, mines, deforestedCells } from './state.js';

// ── Spatial helpers ────────────────────────────────────────

export function dist2D(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx, dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

export function isInSafeZone(x: number, z: number): boolean {
  return dist2D(x, z, 0, 0) < SAFE_R;
}

export function isInForest(x: number, z: number): boolean {
  return dist2D(x, z, 0, 0) < FOREST_R;
}

export function cellKey(x: number, z: number): string {
  return `${Math.round(x)},${Math.round(z)}`;
}

/** Checks for collisions with any static object (trees, mines, workbench). */
export function checkWorldCollision(x: number, z: number, r: number): boolean {
  // 1. Trees
  for (const t of trees) {
    if (t.alive && dist2D(x, z, t.x, t.z) < r + 0.6) return true;
  }
  // 2. Mines
  for (const m of mines) {
    if (m.alive && dist2D(x, z, m.x, m.z) < r + 0.9) return true;
  }
  // 3. Workbench
  if (gameState.workbenchPos && dist2D(x, z, gameState.workbenchPos.x, gameState.workbenchPos.z) < r + 0.9) {
    return true;
  }
  return false;
}

export function deerCanEnter(x: number, z: number): boolean {
  return isInForest(x, z) && !isInSafeZone(x, z);
}

// ── Stumps (left after chopping) ──────────────────────────

export function addStump(x: number, z: number): void {
  const s = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.3, 0.3, 6),
    new THREE.MeshLambertMaterial({ color: 0x4a2a0a })
  );
  s.position.set(x, 0.15, z);
  scene.add(s);
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++)
      deforestedCells.add(cellKey(x + dx, z + dz));
}

// ── Tree factory ──────────────────────────────────────────

export function makeTree(x: number, z: number): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.3, 2.2, 6),
    new THREE.MeshLambertMaterial({ color: 0x5a3a1a })
  );
  trunk.position.y = 1.1; trunk.castShadow = true; g.add(trunk);

  const cols = [0x2d7a1b, 0x3a9a25, 0x1f5a12];
  for (let i = 0; i < 3; i++) {
    const l = new THREE.Mesh(
      new THREE.BoxGeometry(1.8 - i * 0.3, 1.0, 1.8 - i * 0.3),
      new THREE.MeshLambertMaterial({ color: cols[i] })
    );
    l.position.y = 2.4 + i * 0.7; l.castShadow = true; g.add(l);
  }
  scene.add(g);
  trees.push({ mesh: g, x, z, hp: 3, alive: true });
}

// ── Mine factory ──────────────────────────────────────────

export function makeMine(x: number, z: number): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const cols = [0x888899, 0x777788, 0x998888];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(
      new THREE.BoxGeometry(
        0.9 + Math.random() * 0.6,
        0.8 + Math.random() * 0.4,
        0.9 + Math.random() * 0.6
      ),
      new THREE.MeshLambertMaterial({ color: cols[i] })
    );
    r.position.set(
      (Math.random() - 0.5) * 0.8,
      0.4 + Math.random() * 0.3,
      (Math.random() - 0.5) * 0.8
    );
    r.rotation.y = Math.random() * Math.PI; r.castShadow = true; g.add(r);
  }

  const ore = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.3, 0.3),
    new THREE.MeshLambertMaterial({ color: 0xb87333 })
  );
  ore.position.set(0, 0.85, 0); g.add(ore);

  scene.add(g);
  mines.push({ mesh: g, x, z, hp: 3, alive: true });
}

// ── Ground & world dressing ───────────────────────────────

export function makeGround(): void {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshLambertMaterial({ color: 0x4a7a3a })
  );
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true; scene.add(m);

  const fm = new THREE.Mesh(
    new THREE.CircleGeometry(FOREST_R, 48),
    new THREE.MeshLambertMaterial({ color: 0x2d5a1b })
  );
  fm.rotation.x = -Math.PI / 2; fm.position.y = 0.01; fm.receiveShadow = true; scene.add(fm);

  const sm = new THREE.Mesh(
    new THREE.CircleGeometry(SAFE_R, 32),
    new THREE.MeshLambertMaterial({ color: 0x6aaa5a })
  );
  sm.rotation.x = -Math.PI / 2; sm.position.y = 0.02; scene.add(sm);

  const rm = new THREE.Mesh(
    new THREE.RingGeometry(FOREST_R, FOREST_R + 0.5, 64),
    new THREE.MeshBasicMaterial({ color: 0x8b6914, side: THREE.DoubleSide })
  );
  rm.rotation.x = -Math.PI / 2; rm.position.y = 0.03; scene.add(rm);

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 5),
    new THREE.MeshLambertMaterial({ color: 0x555555 })
  );
  road.rotation.x = -Math.PI / 2; road.position.set(100, 0.01, 0); scene.add(road);

  const lab = new THREE.Mesh(
    new THREE.BoxGeometry(14, 7, 11),
    new THREE.MeshLambertMaterial({ color: 0x7a7a8a })
  );
  lab.position.set(152, 3.5, 0); lab.castShadow = true; scene.add(lab);

  const labRoof = new THREE.Mesh(
    new THREE.BoxGeometry(14, 1.5, 11),
    new THREE.MeshLambertMaterial({ color: 0x555566 })
  );
  labRoof.position.set(152, 7.75, 0); scene.add(labRoof);

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 3),
    new THREE.MeshBasicMaterial({ color: 0x00ff44, side: THREE.DoubleSide })
  );
  glow.position.set(144.9, 3.5, 0); glow.rotation.y = Math.PI / 2; scene.add(glow);

  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 2, 4),
    new THREE.MeshBasicMaterial({ color: 0x00ee00 })
  );
  sign.position.set(144.5, 2.5, 0); scene.add(sign);
}

// ── World generation ──────────────────────────────────────

export function generateWorld(): void {
  let p = 0;
  while (p < TREE_COUNT) {
    const a = Math.random() * Math.PI * 2;
    const r = SAFE_R + 2 + Math.random() * (FOREST_R - SAFE_R - 4);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.sqrt(x * x + z * z) > 48) continue;
    if (Math.abs(x - (FOREST_R + 2)) < 3) continue;
    makeTree(x, z); p++;
  }
  let mp = 0;
  while (mp < MINE_COUNT) {
    const a = Math.random() * Math.PI * 2;
    const r = FOREST_R * 0.45 + Math.random() * FOREST_R * 0.45;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.sqrt(x * x + z * z) < SAFE_R + 4) continue;
    makeMine(x, z); mp++;
  }
}
