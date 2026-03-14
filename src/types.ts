// ── Map Types ──

export interface Waypoint {
  x: number;
  y: number;
}

export interface EnemyPath {
  id: string;
  waypoints: Waypoint[];
}

export interface TowerSpot {
  id: string;
  x: number;
  y: number;
  allowedTypes?: string[];
}

export interface MapData {
  id: string;
  name: string;
  width: number;
  height: number;
  towerSpots: TowerSpot[];
  paths: EnemyPath[];
  startingGold: number;
  startingLives: number;
  waves?: WaveData[];
}

// ── Tower Types ──

export interface TowerSpecial {
  type: 'splash' | 'slow' | 'dot' | 'chain';
  value: number;
  duration?: number;
  radius?: number;
}

export interface TowerLevel {
  damage: number;
  range: number;
  fireRate: number;
  cost: number;
  projectileSpeed?: number;
  special?: TowerSpecial;
}

export interface TowerData {
  id: string;
  name: string;
  description: string;
  category: 'archer' | 'mage' | 'barracks' | 'artillery' | 'custom';
  levels: TowerLevel[];
  maxLevel: number;
  tint: number;
  imageData?: string;
}

// ── Enemy Types ──

export interface EnemyAbility {
  type: 'heal' | 'speed_boost' | 'spawn' | 'shield' | 'teleport';
  value: number;
  cooldown: number;
  duration?: number;
  spawnId?: string;
}

export interface EnemyData {
  id: string;
  name: string;
  health: number;
  speed: number;
  armor: number;
  magicResist: number;
  reward: number;
  tint: number;
  size: number;
  abilities?: EnemyAbility[];
  isBoss?: boolean;
  isFlying?: boolean;
  imageData?: string;
}

// ── Hero Types ──

export interface HeroAbility {
  id: string;
  name: string;
  description: string;
  damage?: number;
  radius?: number;
  duration?: number;
  cooldown: number;
  manaCost: number;
  type: 'active' | 'passive';
  effect: 'damage' | 'heal' | 'buff' | 'debuff' | 'summon' | 'aoe';
  tint: number;
}

export interface HeroData {
  id: string;
  name: string;
  description: string;
  health: number;
  damage: number;
  attackSpeed: number;
  moveSpeed: number;
  range: number;
  armor: number;
  abilities: HeroAbility[];
  tint: number;
  size: number;
  imageData?: string;
}

// ── Wave Types ──

export interface WaveEnemy {
  enemyId: string;
  count: number;
  delay: number;
  pathId: string;
}

export interface WaveData {
  id: number;
  enemies: WaveEnemy[];
  reward: number;
  delayBefore: number;
}

// ── Game State ──

export interface GameState {
  gold: number;
  lives: number;
  currentWave: number;
  totalWaves: number;
  isPaused: boolean;
  speed: number;
  isGameOver: boolean;
  isVictory: boolean;
}
