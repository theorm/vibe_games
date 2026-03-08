// Ground, trees, mines, world generation, and spatial helpers
declare const THREE: typeof import('three');

import { scene, renderer } from './scene.js';
import { FOREST_R, SAFE_R, TREE_COUNT, MINE_COUNT } from './constants.js';
import { gameState, trees, mines, deforestedCells } from './state.js';

// ── Spatial helpers ────────────────────────────────────────

export function dist2D(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx, dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

function intersectsRect2D(
  x: number,
  z: number,
  r: number,
  cx: number,
  cz: number,
  halfW: number,
  halfD: number
): boolean {
  return Math.abs(x - cx) < halfW + r && Math.abs(z - cz) < halfD + r;
}

function intersectsCircle2D(
  x: number,
  z: number,
  r: number,
  cx: number,
  cz: number,
  cr: number
): boolean {
  return dist2D(x, z, cx, cz) < r + cr;
}

function collidesWithRocketSite(x: number, z: number, r: number): boolean {
  const rx = gameState.rocketPos.x;
  const rz = gameState.rocketPos.z;

  // Pad and nearby infrastructure footprint.
  if (intersectsRect2D(x, z, r, rx, rz, 8.1, 8.1)) return true;
  if (intersectsRect2D(x, z, r, rx - 5, rz - 5, 1.8, 1.8)) return true; // gantry tower
  if (intersectsRect2D(x, z, r, rx - 2, rz - 5, 2.9, 0.6)) return true; // service arms

  // Horizontal fuel tanks.
  if (intersectsRect2D(x, z, r, rx + 6, rz - 4, 2.2, 1.6)) return true;
  if (intersectsRect2D(x, z, r, rx + 6, rz, 2.2, 1.6)) return true;
  if (intersectsRect2D(x, z, r, rx + 6, rz + 4, 2.2, 1.6)) return true;

  // Rocket body + boosters.
  if (intersectsCircle2D(x, z, r, rx, rz, 2.9)) return true;
  if (intersectsCircle2D(x, z, r, rx + 2.4, rz, 0.95)) return true;
  if (intersectsCircle2D(x, z, r, rx - 2.4, rz, 0.95)) return true;

  return false;
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

/** Checks for collisions with any static object (trees, mines, workbench, castle, rocket site). */
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
  // 4. Castle
  if (dist2D(x, z, gameState.castlePos.x, gameState.castlePos.z) < r + gameState.castleRadius) {
    return true;
  }
  // 5. Rocket launch site (pad + rocket + gantry + tanks)
  if (collidesWithRocketSite(x, z, r)) {
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

// ── Rocket Site factory ───────────────────────────────────

function tuneSiteTexture(
  tex: import('three').Texture,
  repeatX: number,
  repeatY: number,
  isColor: boolean
): void {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (isColor) tex.encoding = THREE.sRGBEncoding;
}

function loadSiteTexture(
  loader: import('three').TextureLoader,
  path: string,
  repeatX: number,
  repeatY: number,
  isColor: boolean
): import('three').Texture {
  const tex = loader.load(path, undefined, undefined, () => {
    console.warn(`[rocket-site] Failed to load texture: ${path}`);
  });
  tuneSiteTexture(tex, repeatX, repeatY, isColor);
  return tex;
}

function makeRocketHullTexture(): import('three').CanvasTexture {
  const width = 1024;
  const height = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const baseGrad = ctx.createLinearGradient(0, 0, width, 0);
  baseGrad.addColorStop(0, '#e9edf3');
  baseGrad.addColorStop(0.5, '#ffffff');
  baseGrad.addColorStop(1, '#dfe5ec');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, width, height);

  // Panel seams + rivets for a painted orbital launcher look.
  ctx.strokeStyle = 'rgba(56,67,82,0.28)';
  ctx.lineWidth = 6;
  for (let y = 150; y < height; y += 180) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(70,84,100,0.2)';
  ctx.lineWidth = 4;
  for (let x = 128; x < width; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  const bands = [
    { y: 420, h: 84 },
    { y: 1110, h: 68 },
    { y: 1600, h: 60 },
  ];
  for (const band of bands) {
    ctx.fillStyle = '#171f2b';
    ctx.fillRect(0, band.y, width, band.h);
    ctx.fillStyle = '#be3036';
    ctx.fillRect(0, band.y + band.h - 16, width, 16);
  }

  ctx.fillStyle = '#2a3850';
  ctx.font = '700 110px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('FSA', width * 0.5, 300);

  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const c = 232 + Math.floor(Math.random() * 20);
    ctx.fillStyle = `rgba(${c},${c},${c + 2},0.16)`;
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tuneSiteTexture(tex, 1, 1, true);
  return tex;
}

function makeRocketPanelNormalTexture(): import('three').CanvasTexture {
  const width = 512;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#7676ff';
  ctx.lineWidth = 2;
  for (let y = 64; y < height; y += 90) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  for (let i = 0; i < 2200; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    ctx.fillStyle = i % 2 === 0 ? '#7b7bff' : '#8686ff';
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tuneSiteTexture(tex, 1, 1, false);
  return tex;
}

function makeRocketRoughnessTexture(): import('three').CanvasTexture {
  const width = 512;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#8d8d8d';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#757575';
  for (let y = 95; y < height; y += 180) {
    ctx.fillRect(0, y, width, 14);
  }

  for (let i = 0; i < 4200; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const v = 112 + (Math.random() * 60) | 0;
    ctx.fillStyle = `rgba(${v},${v},${v},0.18)`;
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tuneSiteTexture(tex, 1, 1, false);
  return tex;
}

export function makeRocketSite(): void {
  const rx = gameState.rocketPos.x, rz = gameState.rocketPos.z;
  const g = new THREE.Group();
  g.position.set(rx, 0, rz);

  const loader = new THREE.TextureLoader();
  const metalDiff = loadSiteTexture(loader, 'assets/textures/car/metal_plate_02_diff_1k.jpg', 1.6, 3, true);
  const metalArm = loadSiteTexture(loader, 'assets/textures/car/metal_plate_02_arm_1k.png', 1.6, 3, false);
  const metalNor = loadSiteTexture(loader, 'assets/textures/car/metal_plate_02_nor_gl_1k.png', 1.6, 3, false);

  const rocketHullMap = makeRocketHullTexture();
  const rocketHullNormal = makeRocketPanelNormalTexture();
  const rocketHullRoughness = makeRocketRoughnessTexture();

  const structuralSteel = new THREE.MeshStandardMaterial({
    color: 0xbfc7ce,
    map: metalDiff,
    normalMap: metalNor,
    roughnessMap: metalArm,
    metalnessMap: metalArm,
    metalness: 0.78,
    roughness: 0.42,
  });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x8c8d90, roughness: 0.95, metalness: 0.03 });
  const hazard = new THREE.MeshStandardMaterial({ color: 0xf6ca17, roughness: 0.62, metalness: 0.08 });
  const rocketHull = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: rocketHullMap,
    normalMap: rocketHullNormal,
    roughnessMap: rocketHullRoughness,
    metalness: 0.24,
    roughness: 0.52,
  });
  const rocketTrim = new THREE.MeshStandardMaterial({
    color: 0x1a2231,
    map: metalDiff,
    normalMap: metalNor,
    roughnessMap: metalArm,
    metalnessMap: metalArm,
    metalness: 0.72,
    roughness: 0.35,
  });
  const engine = new THREE.MeshStandardMaterial({
    color: 0x505a66,
    map: metalDiff,
    normalMap: metalNor,
    roughnessMap: metalArm,
    metalnessMap: metalArm,
    metalness: 0.9,
    roughness: 0.26,
    emissive: 0x241100,
    emissiveIntensity: 0.15,
  });

  // Launch pad base
  const pad = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 16), concrete);
  pad.position.y = 0.25; pad.receiveShadow = true; g.add(pad);

  // Pad markings (Yellow hazard stripes)
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 0.5), hazard);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.51;
    if (i === 0) m.position.z = 7.75;
    if (i === 1) m.position.z = -7.75;
    if (i === 2) { m.position.x = 7.75; m.rotation.z = Math.PI / 2; }
    if (i === 3) { m.position.x = -7.75; m.rotation.z = Math.PI / 2; }
    g.add(m);
  }

  // Launch Tower (Gantry)
  const towerHeight = 25;
  const tower = new THREE.Mesh(new THREE.BoxGeometry(3, towerHeight, 3), structuralSteel);
  tower.position.set(-5, towerHeight / 2 + 0.5, -5);
  tower.castShadow = true; g.add(tower);

  // Tower detail arms
  for (let i = 0; i < 6; i++) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, 0.4), structuralSteel);
    arm.position.set(-2, 4 + i * 4, -5);
    arm.castShadow = true;
    g.add(arm);
  }

  // The Rocket
  const rocket = new THREE.Group();
  rocket.position.y = 0.5;
  
  // First stage
  const stage1 = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 12, 20), rocketHull);
  stage1.position.y = 6; stage1.castShadow = true; rocket.add(stage1);
  
  // Second stage
  const stage2 = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 8, 20), rocketHull);
  stage2.position.y = 16; stage2.castShadow = true; rocket.add(stage2);
  
  // Third stage
  const stage3 = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.4, 4, 20), rocketHull);
  stage3.position.y = 22; stage3.castShadow = true; rocket.add(stage3);
  
  // Nose Cone
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.0, 3, 20), rocketHull);
  nose.position.y = 25.5; nose.castShadow = true; rocket.add(nose);

  // Inter-stage rings break up silhouette and improve stage readability.
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.82, 0.08, 10, 36), rocketTrim);
  ring1.rotation.x = Math.PI / 2;
  ring1.position.y = 11.95;
  rocket.add(ring1);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.08, 10, 32), rocketTrim);
  ring2.rotation.x = Math.PI / 2;
  ring2.position.y = 19.95;
  rocket.add(ring2);

  // Fins
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3, 2), rocketTrim);
    const a = (i / 4) * Math.PI * 2;
    fin.position.set(Math.cos(a) * 2.2, 1.5, Math.sin(a) * 2.2);
    fin.rotation.y = -a;
    fin.castShadow = true;
    rocket.add(fin);
  }

  // Engines
  for (let i = 0; i < 5; i++) {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 0.8, 12), engine);
    const a = (i / 4) * Math.PI * 2;
    const r = i === 4 ? 0 : 0.8;
    nozzle.position.set(Math.cos(a) * r, -0.4, Math.sin(a) * r);
    rocket.add(nozzle);
  }

  // Boosters
  for (let i = 0; i < 2; i++) {
    const booster = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 8, 16), rocketHull);
    const side = i === 0 ? 1 : -1;
    booster.position.set(side * 2.4, 4, 0); booster.castShadow = true;
    rocket.add(booster);
    const bNose = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.5, 16), rocketHull);
    bNose.position.set(side * 2.4, 8.75, 0); bNose.castShadow = true; rocket.add(bNose);
  }

  g.add(rocket);

  // Infrastructure: Fuel tanks
  for (let i = 0; i < 3; i++) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 4, 14), structuralSteel);
    tank.position.set(6, 2, -4 + i * 4);
    tank.rotation.z = Math.PI / 2;
    tank.castShadow = true; g.add(tank);
  }

  scene.add(g);

  // Concrete paths to make it reachable
  const path1 = new THREE.Mesh(new THREE.PlaneGeometry(8, 40), concrete);
  path1.rotation.x = -Math.PI / 2;
  path1.receiveShadow = true;
  path1.position.set(rx, 0.03, rz - 20); // From edge to site
  scene.add(path1);

  const path2 = new THREE.Mesh(new THREE.PlaneGeometry(6, 50), concrete);
  path2.rotation.x = -Math.PI / 2;
  path2.receiveShadow = true;
  path2.position.set(0, 0.02, 35); // From safe zone to forest edge
  scene.add(path2);
}

// ── Castle factory ────────────────────────────────────────

export function makeCastle(): void {
  const cx = gameState.castlePos.x, cz = gameState.castlePos.z;
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);

  const stone = new THREE.MeshLambertMaterial({ color: 0x888899 });
  const roof  = new THREE.MeshLambertMaterial({ color: 0xaa4444 });
  const gold  = new THREE.MeshLambertMaterial({ color: 0xffd700 });
  const skin  = new THREE.MeshLambertMaterial({ color: 0xf5d0a9 });
  const dress = new THREE.MeshLambertMaterial({ color: 0xff69b4 });

  // Main keep
  const keep = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 12), stone);
  keep.position.y = 4; keep.castShadow = true; keep.receiveShadow = true; g.add(keep);

  // Four corner towers
  for (let x of [-6, 6]) {
    for (let z of [-6, 6]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 12, 8), stone);
      t.position.set(x, 6, z); t.castShadow = true; g.add(t);
      const r = new THREE.Mesh(new THREE.ConeGeometry(2.5, 4, 8), roof);
      r.position.set(x, 14, z); g.add(r);
    }
  }

  // Tallest tower (North-West)
  const tallT = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 18, 12), stone);
  tallT.position.set(-4, 9, -4); tallT.castShadow = true; g.add(tallT);

  // Balcony on the tallest tower
  const balcony = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.4, 12), stone);
  balcony.position.set(-4, 15.5, -4); g.add(balcony);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.1, 8, 24), stone);
  rail.position.set(-4, 16.2, -4); rail.rotation.x = Math.PI / 2; g.add(rail);

  // Princess on the balcony
  const pG = new THREE.Group();
  pG.position.set(-4, 15.7, -4 + 2.5); // Sitting on the south edge of the balcony
  
  const pBody = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 8), dress);
  pBody.position.y = 0.4; pG.add(pBody);
  const pHead = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), skin);
  pHead.position.y = 1.0; pG.add(pHead);
  const pHair = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold);
  pHair.position.y = 1.05; pG.add(pHair);
  const pCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.1, 0.15, 6), gold);
  pCrown.position.y = 1.35; pG.add(pCrown);
  
  g.add(pG);

  // Castle gate (North side)
  const gate = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 0.5), new THREE.MeshLambertMaterial({ color: 0x5a3a1a }));
  gate.position.set(0, 2.5, 6); g.add(gate);

  scene.add(g);

  // Path from forest edge to castle
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 6),
    new THREE.MeshLambertMaterial({ color: 0x777777 })
  );
  path.rotation.x = -Math.PI / 2;
  path.position.set(-65, 0.03, -65);
  path.rotation.z = Math.PI / 4;
  scene.add(path);
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

  makeCastle();
  makeRocketSite();
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
    
    // Clear path to rocket site (Corridor around x=0, z>0)
    if (Math.abs(x) < 5 && z > 0) continue;
    
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
