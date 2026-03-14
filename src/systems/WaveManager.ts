import type { WaveData, EnemyData, MapData } from '../types';
import { Enemy } from '../entities/Enemy';

export class WaveManager {
  public scene: Phaser.Scene;
  public waves: WaveData[];
  public enemies: Enemy[] = [];
  public currentWaveIndex: number = -1;
  public isSpawning: boolean = false;
  public allWavesComplete: boolean = false;

  private enemyDefs: Map<string, EnemyData>;
  private mapData: MapData;
  private spawnTimers: Phaser.Time.TimerEvent[] = [];
  private pendingSpawns: number = 0;

  // Callbacks
  public onEnemyReachedEnd?: (enemy: Enemy) => void;
  public onEnemyKilled?: (enemy: Enemy) => void;
  public onWaveComplete?: (waveIndex: number) => void;

  constructor(scene: Phaser.Scene, waves: WaveData[], enemyDefs: EnemyData[], mapData: MapData) {
    this.scene = scene;
    this.waves = waves;
    this.enemyDefs = new Map(enemyDefs.map(e => [e.id, e]));
    this.mapData = mapData;
  }

  startNextWave(): boolean {
    if (this.isSpawning) return false;
    if (this.currentWaveIndex >= this.waves.length - 1) return false;

    this.currentWaveIndex++;
    const wave = this.waves[this.currentWaveIndex];
    this.isSpawning = true;
    this.pendingSpawns = 0;

    for (const group of wave.enemies) {
      this.pendingSpawns += group.count;
    }

    // Spawn each enemy group
    for (const group of wave.enemies) {
      const enemyDef = this.enemyDefs.get(group.enemyId);
      if (!enemyDef) continue;

      // Match path by ID, fall back to first path if no match (e.g. custom maps)
      const path = this.mapData.paths.find(p => p.id === group.pathId)
        ?? this.mapData.paths[0];
      if (!path || path.waypoints.length < 2) continue;

      for (let i = 0; i < group.count; i++) {
        const delay = wave.delayBefore + i * group.delay;
        const timer = this.scene.time.delayedCall(delay, () => {
          if (!this.scene || !this.scene.sys.isActive()) return;
          const enemy = new Enemy(this.scene, enemyDef, [...path.waypoints]);
          enemy.setDepth(2);
          this.enemies.push(enemy);
          this.pendingSpawns--;
        });
        this.spawnTimers.push(timer);
      }
    }

    return true;
  }

  tick(time: number, delta: number) {
    // Update all enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];

      if (enemy.isDead || !enemy.active) {
        if (enemy.isDead) {
          this.onEnemyKilled?.(enemy);
        }
        this.enemies.splice(i, 1);
        continue;
      }

      enemy.tick(delta);

      if (enemy.hasReachedEnd()) {
        this.onEnemyReachedEnd?.(enemy);
        enemy.isDead = true;
        enemy.destroy();
        this.enemies.splice(i, 1);
      }
    }

    // Check if wave is complete
    if (this.isSpawning && this.pendingSpawns <= 0 && this.enemies.length === 0) {
      this.isSpawning = false;
      this.onWaveComplete?.(this.currentWaveIndex);

      if (this.currentWaveIndex >= this.waves.length - 1) {
        this.allWavesComplete = true;
      }
    }
  }

  getAliveEnemies(): Enemy[] {
    return this.enemies.filter(e => !e.isDead && e.active);
  }

  destroy() {
    this.spawnTimers.forEach(t => t.destroy());
    this.enemies.forEach(e => { if (e.active) e.destroy(); });
    this.enemies = [];
    this.spawnTimers = [];
  }
}
