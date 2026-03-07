// All UI rendering: HUD, messages, minimap, hints, flash, event banners
import { gameState, trees, mines, aliens, zombies } from './state.js';
import { FOREST_R, SAFE_R } from './constants.js';

function actionControlName(): string {
  return gameState.inputProfile === 'touch' ? 'TAP' : 'SPACE';
}

export function setActionHint(txt: string): void {
  document.getElementById('action-hint')!.textContent = txt;
}

export function showMessage(html: string, dur = 0): void {
  const el = document.getElementById('message')!;
  el.innerHTML = html; el.style.display = 'block';
  if (dur > 0) setTimeout(() => { if (el.style.display !== 'none') el.style.display = 'none'; }, dur);
}

export function hideMessage(): void {
  document.getElementById('message')!.style.display = 'none';
}

export function flashColor(col: string): void {
  const f = document.getElementById('screen-flash')!;
  f.style.background = col; f.style.opacity = '1';
  setTimeout(() => { f.style.opacity = '0'; }, 140);
}

export function showEventBanner(txt: string, dur: number, col = '#f00'): void {
  const b = document.getElementById('event-banner')!;
  b.textContent = txt; b.style.borderColor = col; b.style.display = 'block';
  if (dur > 0) setTimeout(() => { b.style.display = 'none'; }, dur);
}

export function showFloatingText(txt: string): void {
  const el = document.createElement('div');
  el.textContent = txt;
  el.style.cssText = 'position:fixed;left:50%;top:42%;transform:translateX(-50%);color:#fff;font-size:16px;font-family:Courier New,monospace;text-shadow:1px 1px 0 #000;pointer-events:none;z-index:50;transition:opacity 1s,top 1s;';
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.top = '36%'; }, 100);
  setTimeout(() => el.remove(), 1200);
}

export function updateHUD(deer: { hp: number }, player: { pos: any }): void {
  document.getElementById('health-fill')!.style.width = Math.max(0, gameState.playerHP) + '%';
  document.getElementById('health-text')!.textContent = String(Math.ceil(Math.max(0, gameState.playerHP)));
  document.getElementById('deer-fill')!.style.width   = gameState.deerHP + '%';
  document.getElementById('deer-text')!.textContent   = String(Math.ceil(gameState.deerHP));
  document.getElementById('resource-info')!.innerHTML = `\u{1FAB5} ${gameState.resources.wood} &nbsp; ⛰️ ${gameState.resources.ore}`;

  const inv = document.getElementById('inventory')!;
  inv.innerHTML = '';
  [
    { icon: '🪓', label: 'Axe',                         show: !gameState.hasSword },
    { icon: '⛏️', label: 'Pickaxe',                     show: gameState.hasPickaxe },
    { icon: '🗡️', label: 'Sword',                       show: gameState.hasSword },
    { icon: '🪵', label: `Wood×${gameState.resources.wood}`, show: gameState.resources.wood > 0 },
    { icon: '⛰️', label: `Ore×${gameState.resources.ore}`,   show: gameState.resources.ore > 0 },
    { icon: '🚗', label: 'Car',                          show: true },
  ].forEach(item => {
    if (!item.show) return;
    const d = document.createElement('div'); d.className = 'inv-slot';
    d.innerHTML = `<div class="icon">${item.icon}</div><div>${item.label}</div>`;
    inv.appendChild(d);
  });

  ['obj0', 'obj1', 'obj2', 'obj3', 'obj4'].forEach((id, i) => {
    const el = document.getElementById(id)!;
    if (i < gameState.stage) el.className = 'done';
    else if (i === gameState.stage) el.className = 'active';
    else el.className = '';
  });
}

export function updateClock(renderer: any, scene: any, sun: any, ambient: any, moonLight: any): void {
  const t = gameState.dayTime;
  const names = ['🌙 Night', '🌅 Dawn', '🌄 Morning', '☀️ Noon', '🌇 Dusk', '🌆 Evening', '🌙 Night'];
  const idx = Math.min(Math.floor(((t + 1 / 14) % 1) * 7), 6);
  document.getElementById('clock')!.textContent = names[idx];

  let sr: number, sg: number, sb: number;
  if      (t < 0.25) { const f = t / 0.25;             sr = Math.floor(10  + f * 120); sg = Math.floor(10  + f * 100); sb = Math.floor(30  + f * 140); }
  else if (t < 0.5)  { const f = (t - 0.25) / 0.25;   sr = Math.floor(130 + f * 5);   sg = Math.floor(110 + f * 96);  sb = Math.floor(170 + f * 65);  }
  else if (t < 0.75) { const f = (t - 0.5)  / 0.25;   sr = Math.floor(135 - f * 50);  sg = Math.floor(206 - f * 130); sb = Math.floor(235 - f * 100); }
  else               { const f = (t - 0.75) / 0.25;   sr = Math.floor(85  - f * 75);  sg = Math.floor(76  - f * 66);  sb = Math.floor(135 - f * 105); }
  const skyHex = (sr! << 16) | (sg! << 8) | sb!;
  renderer.setClearColor(skyHex);
  scene.fog.color.setHex(skyHex);

  const sunInt = Math.max(0, Math.sin(t * Math.PI * 2 - Math.PI / 2) * 0.8 + 0.5);
  sun.intensity      = sunInt;
  ambient.intensity  = 0.3 + sunInt * 0.4;
  moonLight.intensity = Math.max(0, 0.4 - sunInt * 0.3);
}

export function updateCarHint(playerPos: any, carPos: any): void {
  const ch = document.getElementById('car-hint')!;
  const nearCar = Math.sqrt(
    (playerPos.x - carPos.x) ** 2 + (playerPos.z - carPos.z) ** 2
  ) < 3;
  if (!gameState.inCar && nearCar) {
    ch.style.display = 'block';
    ch.textContent = `[${actionControlName()}] Get in car 🚗`;
  } else if (gameState.inCar) {
    ch.style.display = 'block';
    ch.textContent = gameState.inputProfile === 'touch'
      ? '[TAP] Exit car  |  Screen Zones Drive + Steer'
      : '[SPACE] Exit car  |  ↑↓ Drive  ←→ Steer';
  }
  else                             { ch.style.display = 'none'; }
}

export function updateMinimap(playerPos: any, carPos: any, deerPos: any, deerAlive: boolean): void {
  const mm  = document.getElementById('mm') as HTMLCanvasElement;
  const ctx = mm.getContext('2d')!;
  const S = 110, scale = S / (FOREST_R * 2 + 24), cx = S / 2, cy = S / 2;

  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#1a3a10'; ctx.fillRect(0, 0, S, S);
  ctx.beginPath(); ctx.arc(cx, cy, FOREST_R * scale, 0, Math.PI * 2); ctx.fillStyle = '#2d5a1b'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, SAFE_R  * scale, 0, Math.PI * 2); ctx.fillStyle = '#4a8a3a'; ctx.fill();

  ctx.fillStyle = '#555'; ctx.fillRect(cx + FOREST_R * scale, cy - 2, 40, 4);
  ctx.fillStyle = '#556'; ctx.fillRect(cx + FOREST_R * scale + 37, cy - 5, 10, 10);
  ctx.fillStyle = '#0f0'; ctx.fillRect(cx + FOREST_R * scale + 38, cy - 4, 8, 8);

  for (const t of trees)  { if (!t.alive) continue; ctx.fillStyle = '#1a4a10'; ctx.fillRect(cx + t.x * scale - 1, cy + t.z * scale - 1, 2, 2); }
  for (const m of mines)  { if (!m.alive) continue; ctx.fillStyle = '#888'; ctx.fillRect(cx + m.x * scale - 2, cy + m.z * scale - 2, 4, 4); }
  for (const a of aliens) { if (!a.alive) continue; ctx.fillStyle = '#0f0'; ctx.beginPath(); ctx.arc(cx + a.pos.x * scale, cy + a.pos.z * scale, 3, 0, Math.PI * 2); ctx.fill(); }
  for (const z of zombies){ if (!z.alive) continue; ctx.fillStyle = '#fa0'; ctx.beginPath(); ctx.arc(cx + z.pos.x * scale, cy + z.pos.z * scale, 3, 0, Math.PI * 2); ctx.fill(); }

  if (deerAlive) { ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(cx + deerPos.x * scale, cy + deerPos.z * scale, 3, 0, Math.PI * 2); ctx.fill(); }

  ctx.fillStyle = '#f55'; ctx.fillRect(cx + carPos.x * scale - 3, cy + carPos.z * scale - 2, 6, 4);
  ctx.fillStyle = '#3af'; ctx.beginPath(); ctx.arc(cx + playerPos.x * scale, cy + playerPos.z * scale, 3, 0, Math.PI * 2); ctx.fill();
}

export function triggerWin(): void {
  gameState.gameWon  = true;
  gameState.deerAlive = false;
  showMessage(`🎉 <strong>VICTORY!</strong><br><br>You slew the vicious deer!<br>The forest is saved.<br><br><em style="font-size:13px">Reload to play again</em>`);
}

export function triggerDeath(by = 'deer'): void {
  gameState.gameOver = true;
  const msgs: Record<string, string> = {
    deer:   '🦌 The deer ate you.',
    alien:  '👽 Abducted and probed.',
    zombie: '🧟 You became a zombie.',
  };
  showMessage(`💀 <strong>YOU DIED</strong><br><br>${msgs[by] || msgs.deer}<br><br><em style="font-size:13px">Reload to try again</em>`);
}
