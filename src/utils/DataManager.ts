import type { TowerData, EnemyData, HeroData, WaveData, MapData } from '../types';
import defaultTowers from '../data/towers.json';
import defaultEnemies from '../data/enemies.json';
import defaultHeroes from '../data/heroes.json';
import defaultWaves from '../data/waves.json';
import builtInMaps from '../data/maps/index';

const KEYS = {
  towers: 'td-towers',
  enemies: 'td-enemies',
  heroes: 'td-heroes',
  waves: 'td-waves',
  maps: 'td-maps',
};

function load<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, data: unknown): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export const DataManager = {
  loadTowers(): TowerData[] {
    return load(KEYS.towers, defaultTowers as unknown as TowerData[]);
  },
  saveTowers(data: TowerData[]) {
    save(KEYS.towers, data);
  },

  loadEnemies(): EnemyData[] {
    return load(KEYS.enemies, defaultEnemies as unknown as EnemyData[]);
  },
  saveEnemies(data: EnemyData[]) {
    save(KEYS.enemies, data);
  },

  loadHeroes(): HeroData[] {
    return load(KEYS.heroes, defaultHeroes as unknown as HeroData[]);
  },
  saveHeroes(data: HeroData[]) {
    save(KEYS.heroes, data);
  },

  loadWaves(): WaveData[] {
    return load(KEYS.waves, defaultWaves as unknown as WaveData[]);
  },
  saveWaves(data: WaveData[]) {
    save(KEYS.waves, data);
  },

  loadMaps(): MapData[] {
    const custom = load<MapData[]>(KEYS.maps, []);
    // Merge: built-in maps first, then custom maps (skip dupes by id)
    const builtInIds = new Set(builtInMaps.map(m => m.id));
    const uniqueCustom = custom.filter(m => !builtInIds.has(m.id));
    return [...builtInMaps, ...uniqueCustom];
  },
  saveCustomMap(map: MapData) {
    const maps = load<MapData[]>(KEYS.maps, []);
    const idx = maps.findIndex(m => m.id === map.id);
    if (idx >= 0) maps[idx] = map;
    else maps.push(map);
    save(KEYS.maps, maps);
  },
  deleteCustomMap(mapId: string) {
    const maps = load<MapData[]>(KEYS.maps, []);
    save(KEYS.maps, maps.filter(m => m.id !== mapId));
  },
  saveMaps(maps: MapData[]) {
    // Filter out all built-in maps (they're always loaded from the bundle)
    const builtInIds = new Set(builtInMaps.map(m => m.id));
    const custom = maps.filter(m => !builtInIds.has(m.id));
    save(KEYS.maps, custom);
  },

  resetAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  },
  resetCategory(category: keyof typeof KEYS) {
    localStorage.removeItem(KEYS[category]);
  },
};
