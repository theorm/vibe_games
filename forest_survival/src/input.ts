// Keyboard input, player actions, context hints, and progress checks
import { scene } from './scene.js';
import { gameState, keys } from './state.js';
import { trees, mines } from './state.js';
import { PLAYER_ATK_R, CHOP_RANGE } from './constants.js';
import { dist2D, isInSafeZone, addStump } from './world.js';
import { player, playerGroup } from './player.js';
import { addSwordToPlayer } from './player.js';
import { carPos } from './car.js';
import { deer } from './deer.js';
import { placeWorkbench } from './workbench.js';
import { sfxChop, sfxSwing, sfxCraft, initAudio, startDeerYells } from './audio.js';
import { setActionHint, showMessage, hideMessage, updateHUD } from './ui.js';
import {
  initTouchControls,
  forceEnableTouchControls,
  getTouchDetectionInfo,
  isTouchControlsEnabled,
} from './touch-controls.js';

function actionControlName(): string {
  return gameState.inputProfile === 'touch' ? 'TAP' : 'SPACE';
}

function cameraControlName(): string {
  return gameState.inputProfile === 'touch' ? 'VIEW' : 'V';
}

function setDrivingHint(): void {
  const movement = gameState.inputProfile === 'touch'
    ? 'screen zones drive + steer'
    : '↑↓ accelerate, ←→ steer';
  setActionHint(`🚗 Driving! ${movement}, ${cameraControlName()} camera, ${actionControlName()} exit.`);
}

function toggleCarCameraView(): void {
  if (!gameState.inCar) return;
  gameState.driverView = !gameState.driverView;
  if (gameState.inputProfile === 'touch') {
    setActionHint(gameState.driverView
      ? '🚗 Driver view active — tap VIEW to switch back'
      : '🚗 Third-person view active — tap VIEW for driver view');
    return;
  }
  setActionHint(gameState.driverView
    ? '🚗 Driver view — press V to switch back'
    : '🚗 Third-person view — press V for driver view');
}

function handleAction(): void {
  if (gameState.gameOver || gameState.gameWon) return;

  // Car enter/exit
  const nearCar = dist2D(player.pos.x, player.pos.z, carPos.x, carPos.z) < 3;
  if (!gameState.inCar && nearCar) {
    gameState.inCar = true;
    playerGroup.visible = false;
    setDrivingHint();
    return;
  }
  if (gameState.inCar) {
    gameState.inCar = false;
    gameState.driverView = false;
    player.pos.set(carPos.x + 2, 0, carPos.z);
    playerGroup.visible = true;
    setActionHint('Exited car.');
    return;
  }

  const px = player.pos.x, pz = player.pos.z;
  const fwdX = -Math.sin(player.facing), fwdZ = -Math.cos(player.facing);

  // Attack deer
  if (gameState.hasSword && gameState.playerAttackTimer <= 0 && dist2D(px, pz, deer.pos.x, deer.pos.z) < PLAYER_ATK_R) {
    gameState.playerAttackTimer = 0.6;
    sfxSwing(player.pos);
    gameState.deerHP = Math.max(0, gameState.deerHP - 25);
    setActionHint('⚔️ Hit! Deer HP: ' + Math.ceil(gameState.deerHP));
    if (gameState.deerHP <= 0) { gameState.onWin?.(); }
    return;
  }

  // Chop tree
  for (const t of trees) {
    if (!t.alive) continue;
    if (dist2D(px, pz, t.x, t.z) < CHOP_RANGE) {
      t.hp--;
      sfxChop({ x: t.x, y: 0, z: t.z });
      setActionHint(`🪓 Chopping... (${t.hp} hits left)`);
      if (t.hp <= 0) {
        t.alive = false; scene.remove(t.mesh);
        addStump(t.x, t.z); gameState.resources.wood += 3;
        setActionHint('🪵 Got 3 wood!');
        checkProgress();
      }
      return;
    }
  }

  // Mine ore (requires pickaxe)
  if (gameState.hasPickaxe) {
    for (const m of mines) {
      if (!m.alive) continue;
      if (dist2D(px, pz, m.x, m.z) < CHOP_RANGE) {
        m.hp--;
        sfxChop({ x: m.x, y: 0, z: m.z });
        setActionHint(`⛏️ Mining... (${m.hp} hits left)`);
        if (m.hp <= 0) {
          m.alive = false; scene.remove(m.mesh);
          gameState.resources.ore += 3;
          setActionHint('⛰️ Got 3 ore!');
          checkProgress();
        }
        return;
      }
    }
  }

  // Workbench interactions
  const wb = gameState.workbenchPos;
  if (wb && dist2D(px, pz, wb.x, wb.z) < 2.5) {
    if (!gameState.hasPickaxe) {
      if (gameState.resources.wood >= 3) {
        gameState.resources.wood -= 3; gameState.hasPickaxe = true; gameState.stage = Math.max(gameState.stage, 2);
        sfxCraft(wb);
        setActionHint('⛏️ Pickaxe crafted!');
        showMessage(`⛏️ <strong>Pickaxe crafted!</strong><br>Find grey rock formations (mines) deep in the forest.<br>Walk up close and press ${actionControlName()} to mine ore!`, 5000);
        updateHUD(deer, player);
      } else {
        setActionHint(`Need 3 wood for pickaxe — have ${gameState.resources.wood}`);
      }
      return;
    }
    if (!gameState.hasSword) {
      if (gameState.resources.ore >= 3 && gameState.resources.wood >= 2) {
        gameState.resources.ore -= 3; gameState.resources.wood -= 2;
        gameState.hasSword = true; addSwordToPlayer(); gameState.stage = 4;
        sfxCraft(wb);
        setActionHint('🗡️ Sword forged! Hunt the deer!');
        showMessage(`🗡️ <strong>SWORD FORGED!</strong><br>Hunt down the deer and press ${actionControlName()} when close to attack it!`, 5000);
        updateHUD(deer, player);
      } else {
        setActionHint(`Sword needs 3 ore + 2 wood — have ore:${gameState.resources.ore} wood:${gameState.resources.wood}`);
      }
      return;
    }
    setActionHint('Nothing left to craft.'); return;
  }

  // Build workbench in safe zone
  if (!gameState.built.workbench && isInSafeZone(px, pz)) {
    if (gameState.resources.wood >= 5) {
      gameState.resources.wood -= 5;
      const wbX = px + fwdX * 1.5, wbZ = pz + fwdZ * 1.5;
      placeWorkbench(wbX, wbZ);
      gameState.stage = Math.max(gameState.stage, 1);
      sfxCraft({ x: wbX, y: 0, z: wbZ });
      setActionHint(`🔨 Workbench placed! Walk up and press ${actionControlName()}.`);
      showMessage(`🔨 <strong>Workbench built!</strong><br>Walk up to it and press ${actionControlName()}.<br>First craft: Pickaxe (3 wood) → mine ore → Sword (3 ore + 2 wood)`, 5500);
      updateHUD(deer, player);
    } else {
      setActionHint(`Need 5 wood — have ${gameState.resources.wood}`);
    }
    return;
  }

  setActionHint('Nothing to do here.');
}


export function checkProgress(): void {
  if (gameState.resources.wood >= 5 && gameState.stage === 0) {
    gameState.stage = 1;
    showMessage(`🪵 <strong>Enough wood!</strong><br>Go to the safe zone (green circle in center).<br>Press ${actionControlName()} to build a Workbench!`, 5000);
  }
  if (gameState.resources.ore >= 3 && gameState.hasPickaxe && !gameState.hasSword && gameState.stage < 3) {
    gameState.stage = 3;
    showMessage(`⛰️ <strong>Enough ore!</strong><br>Return to the Workbench and press ${actionControlName()} to forge the Sword!`, 5000);
  }
  updateHUD(deer, player);
}

export function updateContextHints(): void {
  if (gameState.gameOver || gameState.gameWon) return;
  if (gameState.inCar) {
    if (gameState.inputProfile === 'touch') setActionHint('🚗 Driving — tap VIEW for camera, TAP to exit');
    else setActionHint('🚗 Driving — V toggle camera, SPACE to exit');
    return;
  }
  const px = player.pos.x, pz = player.pos.z;
  const action = actionControlName();

  if (dist2D(px, pz, carPos.x, carPos.z) < 3) { setActionHint(`[${action}] Get in car 🚗`); return; }
  if (gameState.hasSword && dist2D(px, pz, deer.pos.x, deer.pos.z) < PLAYER_ATK_R + 1.5) { setActionHint(`[${action}] ⚔️ ATTACK THE DEER!`); return; }

  const wb = gameState.workbenchPos;
  if (wb && dist2D(px, pz, wb.x, wb.z) < 2.5) {
    if (!gameState.hasPickaxe) setActionHint(`[${action}] Craft Pickaxe — need 3 wood (have ${gameState.resources.wood})`);
    else if (!gameState.hasSword) setActionHint(`[${action}] Forge Sword — need 3 ore+2 wood (have ${gameState.resources.ore} ore, ${gameState.resources.wood} wood)`);
    else setActionHint('Workbench: fully used!');
    return;
  }

  if (!gameState.built.workbench && isInSafeZone(px, pz) && gameState.resources.wood >= 5) { setActionHint(`[${action}] Build Workbench (5 wood)`); return; }

  for (const m of mines) {
    if (!m.alive) continue;
    if (dist2D(px, pz, m.x, m.z) < 3) { setActionHint(gameState.hasPickaxe ? `[${action}] Mine ore` : '⛏️ Need Pickaxe — craft at Workbench first'); return; }
  }
  for (const t of trees) {
    if (!t.alive) continue;
    if (dist2D(px, pz, t.x, t.z) < 3) { setActionHint(`[${action}] Chop tree`); return; }
  }
  setActionHint('');
}

let introShown = true;

export function initInput(onFirstKey: () => void): void {
  let started = false;
  const touchInfoEl = (): HTMLElement | null => document.getElementById('touch-detect-line');
  const setTouchInfo = (txt: string): void => {
    const el = touchInfoEl();
    if (el) el.textContent = txt;
  };

  const startGameFromInput = (): void => {
    if (started) return;
    started = true;
    if (introShown) { introShown = false; hideMessage(); }
    initAudio();
    startDeerYells();
    onFirstKey();
  };

  window.addEventListener('keydown', e => {
    keys[e.key] = true;
    startGameFromInput();
    if (e.key === ' ') { e.preventDefault(); handleAction(); }
    if (e.key === 'v' || e.key === 'V') toggleCarCameraView();
    if (e.key === 'Escape') hideMessage();
  });
  window.addEventListener('keyup', e => { keys[e.key] = false; });

  initTouchControls({
    onStart: startGameFromInput,
    onAction: handleAction,
    onToggleCamera: toggleCarCameraView,
  });

  const detection = getTouchDetectionInfo();
  if (isTouchControlsEnabled()) {
    setTouchInfo(`Touch detected (${detection.maxTouchPoints} points): controls enabled.`);
  } else if (detection.hasTouchCapability) {
    setTouchInfo(`Touch detected (${detection.maxTouchPoints} points): tap "Enable Touch Controls" if controls are not active.`);
  } else {
    setTouchInfo('Touch not detected automatically. If you are on a phone/tablet, tap "Enable Touch Controls".');
  }

  const manualTouchBtn = document.getElementById('touch-manual-enable');
  if (manualTouchBtn) {
    manualTouchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const enabled = forceEnableTouchControls();
      if (enabled) {
        setTouchInfo('Touch controls enabled manually.');
        setActionHint('Touch controls active: use screen zones to move, TAP for action, VIEW for camera.');
        startGameFromInput();
      } else {
        setTouchInfo('Could not enable touch controls in this build.');
      }
    });
  }

  // Touch devices should be able to start by tapping anywhere on screen.
  window.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      forceEnableTouchControls();
      startGameFromInput();
    }
  });
  window.addEventListener('touchstart', () => {
    forceEnableTouchControls();
    startGameFromInput();
  }, { passive: true });

  // iOS Safari pinch/double-tap gesture guards for full-screen gameplay.
  document.addEventListener('gesturestart', (e: Event) => e.preventDefault());
  document.addEventListener('gesturechange', (e: Event) => e.preventDefault());
}

export { introShown };
