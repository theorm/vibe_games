// Shared mutable game state

export interface TreeData {
  mesh: any;
  x: number;
  z: number;
  hp: number;
  alive: boolean;
}

export interface MineData {
  mesh: any;
  x: number;
  z: number;
  hp: number;
  alive: boolean;
}

export interface EnemyData {
  mesh: any;
  pos: any; // THREE.Vector3
  hp: number;
  alive: boolean;
  speed: number;
  attackTimer: number;
  legPhase?: number;
}

// Keyboard state — mutable object, safe to share across modules
export const keys: Record<string, boolean> = {};

// Central game state object — properties are mutable by any importer
export const gameState = {
  playerHP: 100,
  deerHP: 100,
  playerAttackTimer: 0,
  gameOver: false,
  gameWon: false,
  resources: { wood: 0, ore: 0 },
  built: { workbench: false },
  hasSword: false,
  hasPickaxe: false,
  stage: 0,
  dayTime: 0.30,    // 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk
  wasDawn: false,
  alienTimer: 50 + Math.random() * 60,
  inCar: false,
  carFacing: 0,
  driverView: false,
  inputProfile: 'keyboard' as 'keyboard' | 'touch',
  // Deer state mirrored here so audio.ts can read it without importing deer.ts
  deerState: 'wander' as string,
  deerAlive: true,
  // Workbench position (set by workbench.ts, read by player.ts for collision)
  workbenchPos: null as any,
  // Win/death callbacks — set by main.ts to avoid circular imports
  onWin:   null as (() => void) | null,
  onDeath: null as ((by: string) => void) | null,
};

// Shared arrays — in state.ts so ui.ts can access them for the minimap
// without importing world.ts or enemies.ts (which import ui.ts)
export const trees: TreeData[]          = [];
export const mines: MineData[]          = [];
export const deforestedCells            = new Set<string>();
export const aliens: EnemyData[]        = [];
export const zombies: EnemyData[]       = [];
