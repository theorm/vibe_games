// Entry point — orchestrates module init, main loop, and win/death callbacks
import { renderer, scene, camera, ambient, sun, moonLight } from './scene.js';
import { gameState, aliens, zombies } from './state.js';
import { makeGround, generateWorld } from './world.js';
import { player, playerGroup, buildPlayer, updatePlayer } from './player.js';
import { carPos, updateCar, initCarEnvMap } from './car.js';
import { deer, deerGroup, buildDeer, updateDeer } from './deer.js';
import { updateEnemies, spawnZombies, spawnAliens } from './enemies.js';
import { updateCamera } from './camera.js';
import { updateHUD, updateClock, updateCarHint, updateMinimap, showMessage, triggerWin, triggerDeath } from './ui.js';
import { initInput } from './input.js';

// ── World setup ───────────────────────────────────────────

makeGround();
buildPlayer();
buildDeer();
generateWorld();

// Generate environment map for car reflections (needs scene populated first)
// Render one frame so the scene is populated, then generate env map
renderer.render(scene, camera);
initCarEnvMap();

// ── Win / death callbacks ─────────────────────────────────

gameState.onWin = () => {
  deer.alive = false;
  deerGroup.visible = false;
  triggerWin();
};
gameState.onDeath = (by: string) => { triggerDeath(by); };

// ── Intro message ─────────────────────────────────────────

showMessage(
  `🌲 <strong>FOREST SURVIVAL</strong> 🌲<br><br>
  <em>A vicious deer stalks the woods...<br>also aliens, and zombies from the lab.</em><br><br>
  <b>← → Turn &nbsp;&nbsp; ↑ ↓ Move &nbsp;&nbsp; SPACE Action</b><br>
  <b>Phone/Tablet: full-screen zones to move/steer, tap for action, VIEW button for car camera</b><br><br>
  Chop trees → build workbench → craft pickaxe<br>→ mine ore → forge sword → kill deer<br><br>
  🚗 Red car parked in the safe zone for emergencies<br>
  🧟 Zombies invade from the lab at dawn<br>
  👽 Aliens land randomly — car runs them over!<br><br>
  <strong style="color:#ffd700">Press any arrow key or tap screen to begin</strong>`,
  0
);

let gameStarted = false;
initInput(() => { gameStarted = true; });

// ── HP regen in safe zone ─────────────────────────────────

setInterval(() => {
  if (!gameState.gameOver && !gameState.gameWon) {
    const d = Math.sqrt(player.pos.x ** 2 + player.pos.z ** 2);
    if (d < 8 && gameState.playerHP < 100)
      gameState.playerHP = Math.min(100, gameState.playerHP + 1);
  }
}, 2000);

// ── Day cycle ─────────────────────────────────────────────

let zombiesSpawned = false;

function updateDayCycle(dt: number): void {
  gameState.dayTime = (gameState.dayTime + dt / 120) % 1;

  const isDawn = gameState.dayTime > 0.22 && gameState.dayTime < 0.30;
  if (isDawn && !gameState.wasDawn) {
    gameState.wasDawn = true;
    if (!zombiesSpawned) { zombiesSpawned = true; spawnZombies(); }
  }
  if (!isDawn) gameState.wasDawn = false;

  gameState.alienTimer -= dt;
  if (gameState.alienTimer <= 0) {
    gameState.alienTimer = 60 + Math.random() * 90;
    if (aliens.filter(a => a.alive).length < 3) spawnAliens();
  }

  updateClock(renderer, scene, sun, ambient, moonLight);
}

// ── Main loop ─────────────────────────────────────────────

let lastTime = performance.now();

function animate(now: number): void {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  if (gameStarted && !gameState.gameOver && !gameState.gameWon) {
    updatePlayer(dt);
    updateCar(dt);
    updateDeer(dt);
    updateEnemies(dt);
    updateDayCycle(dt);
    updateCarHint(player.pos, carPos);
  }

  updateCamera();
  updateHUD(deer, player);
  updateMinimap(player.pos, carPos, deer.pos, deer.alive);
  renderer.render(scene, camera);
}

animate(performance.now());

// ── Resize handler ────────────────────────────────────────

window.addEventListener('resize', () => {
  const W = window.innerWidth, H = window.innerHeight;
  renderer.setSize(W, H);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
});
