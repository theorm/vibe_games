// localStorage save/load for progress, actors, and restore-only visuals.
declare const THREE: typeof import('three');

import { gameState, trees, mines, deforestedCells } from './state.js';
import { addStump } from './world.js';
import { placeWorkbench } from './workbench.js';
import { player, playerGroup, addSwordToPlayer } from './player.js';
import { deer, deerGroup } from './deer.js';
import { carPos, carGroup } from './car.js';
import { getCageSaveState, restoreCageVisuals } from './cage.js';
import { getRocketFlightPose, restoreRocketFlightPose, syncRocketVisualsToState } from './rocket.js';

const SAVE_KEY = 'forest-survival-save-v2';
const SAVE_VERSION = 2;

type Vec2 = { x: number; z: number };
type Vec3 = { x: number; y: number; z: number };

interface SaveData {
  version: number;
  savedAt: number;
  gameStarted: boolean;
  state: Record<string, any>;
  player: { pos: Vec3; facing: number; invincTimer: number };
  deer: {
    pos: Vec3;
    facing: number;
    hp: number;
    state: string;
    wanderTarget: Vec3;
    wanderTimer: number;
    attackTimer: number;
    alive: boolean;
  };
  car: { pos: Vec3 };
  world: {
    trees: Array<Vec2 & { hp: number; alive: boolean }>;
    mines: Array<Vec2 & { hp: number; alive: boolean }>;
    deforestedCells: string[];
    workbenchPos: Vec2 | null;
  };
  cage: ReturnType<typeof getCageSaveState>;
  rocket: { pos: Vec3; yaw: number; pitch: number };
}

const STATE_KEYS = [
  'playerHP',
  'deerHP',
  'playerAttackTimer',
  'gameOver',
  'gameWon',
  'resources',
  'built',
  'hasCage',
  'cagePlaced',
  'deerCaptured',
  'cageLoadedInCar',
  'cageLoadedInRocket',
  'rocketLaunched',
  'inRocket',
  'onPlanet',
  'hasSword',
  'hasPickaxe',
  'stage',
  'dayTime',
  'wasDawn',
  'alienTimer',
  'inCar',
  'carFacing',
  'driverView',
  'inputProfile',
  'deerState',
  'deerAlive',
  'deerPos',
];

function cloneStateForSave(): Record<string, any> {
  const state: Record<string, any> = {};
  for (const key of STATE_KEYS) state[key] = structuredClone((gameState as any)[key]);
  return state;
}

function vec3(v: { x: number; y?: number; z: number }): Vec3 {
  return { x: v.x, y: v.y ?? 0, z: v.z };
}

export function saveGame(gameStarted: boolean): void {
  if (!gameStarted) return;

  try {
    const rocketPose = getRocketFlightPose();
    const data: SaveData = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      gameStarted,
      state: cloneStateForSave(),
      player: {
        pos: vec3(player.pos),
        facing: player.facing,
        invincTimer: player.invincTimer,
      },
      deer: {
        pos: vec3(deer.pos),
        facing: deer.facing,
        hp: deer.hp,
        state: deer.state,
        wanderTarget: vec3(deer.wanderTarget),
        wanderTimer: deer.wanderTimer,
        attackTimer: deer.attackTimer,
        alive: deer.alive,
      },
      car: { pos: vec3(carPos) },
      world: {
        trees: trees.map(t => ({ x: t.x, z: t.z, hp: t.hp, alive: t.alive })),
        mines: mines.map(m => ({ x: m.x, z: m.z, hp: m.hp, alive: m.alive })),
        deforestedCells: [...deforestedCells],
        workbenchPos: gameState.workbenchPos
          ? { x: gameState.workbenchPos.x, z: gameState.workbenchPos.z }
          : null,
      },
      cage: getCageSaveState(),
      rocket: {
        pos: vec3(rocketPose.pos),
        yaw: rocketPose.yaw,
        pitch: rocketPose.pitch,
      },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('[save] Unable to write game save', err);
  }
}

export function clearSavedGame(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    console.warn('[save] Unable to clear game save', err);
  }
}

function applyWorldSave(saved: SaveData): void {
  if (saved.world.trees.length === trees.length) {
    for (let i = 0; i < trees.length; i++) {
      const src = saved.world.trees[i];
      const tree = trees[i];
      tree.x = src.x;
      tree.z = src.z;
      tree.hp = src.hp;
      tree.alive = src.alive;
      tree.mesh.position.set(src.x, 0, src.z);
      tree.mesh.visible = src.alive;
      if (!src.alive) addStump(src.x, src.z);
    }
  }

  if (saved.world.mines.length === mines.length) {
    for (let i = 0; i < mines.length; i++) {
      const src = saved.world.mines[i];
      const mine = mines[i];
      mine.x = src.x;
      mine.z = src.z;
      mine.hp = src.hp;
      mine.alive = src.alive;
      mine.mesh.position.set(src.x, 0, src.z);
      mine.mesh.visible = src.alive;
    }
  }

  deforestedCells.clear();
  for (const cell of saved.world.deforestedCells) deforestedCells.add(cell);

  if (saved.world.workbenchPos && saved.state.built?.workbench) {
    placeWorkbench(saved.world.workbenchPos.x, saved.world.workbenchPos.z);
  } else {
    gameState.built.workbench = false;
    gameState.workbenchPos = null;
  }
}

function applyActorSave(saved: SaveData): void {
  player.pos.set(saved.player.pos.x, saved.player.pos.y, saved.player.pos.z);
  player.facing = saved.player.facing;
  player.invincTimer = saved.player.invincTimer;
  playerGroup.position.copy(player.pos);
  playerGroup.rotation.y = player.facing + Math.PI;
  if (gameState.hasSword) addSwordToPlayer();

  deer.pos.set(saved.deer.pos.x, saved.deer.pos.y, saved.deer.pos.z);
  deer.facing = saved.deer.facing;
  deer.hp = saved.deer.hp;
  deer.state = saved.deer.state;
  deer.wanderTarget.set(saved.deer.wanderTarget.x, saved.deer.wanderTarget.y, saved.deer.wanderTarget.z);
  deer.wanderTimer = saved.deer.wanderTimer;
  deer.attackTimer = saved.deer.attackTimer;
  deer.alive = saved.deer.alive;
  deerGroup.position.copy(deer.pos);
  deerGroup.rotation.y = deer.facing;
  deerGroup.visible = deer.alive && !gameState.deerCaptured;

  carPos.set(saved.car.pos.x, saved.car.pos.y, saved.car.pos.z);
  carGroup.position.copy(carPos);
  carGroup.rotation.y = gameState.carFacing + Math.PI / 2;

  if (gameState.inCar) {
    player.pos.copy(carPos);
    playerGroup.visible = false;
  }
}

export function loadSavedGame(): { loaded: boolean; gameStarted: boolean } {
  let saved: SaveData | null = null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { loaded: false, gameStarted: false };
    saved = JSON.parse(raw) as SaveData;
  } catch (err) {
    console.warn('[save] Unable to read game save', err);
    clearSavedGame();
    return { loaded: false, gameStarted: false };
  }

  if (!saved || saved.version !== SAVE_VERSION) {
    clearSavedGame();
    return { loaded: false, gameStarted: false };
  }

  for (const key of STATE_KEYS) {
    if (key in saved.state) (gameState as any)[key] = structuredClone(saved.state[key]);
  }

  applyWorldSave(saved);
  applyActorSave(saved);
  restoreRocketFlightPose(saved.rocket);
  restoreCageVisuals(saved.cage);
  syncRocketVisualsToState();

  return { loaded: true, gameStarted: saved.gameStarted };
}

export function initPersistenceHooks(getGameStarted: () => boolean): void {
  setInterval(() => saveGame(getGameStarted()), 1000);
  window.addEventListener('pagehide', () => saveGame(getGameStarted()));
  window.addEventListener('beforeunload', () => saveGame(getGameStarted()));

  document.getElementById('reset-game-btn')?.addEventListener('click', () => {
    if (!window.confirm('Reset saved Forest Survival progress and start over?')) return;
    clearSavedGame();
    window.location.reload();
  });
}
