import Phaser from 'phaser';
import type { TowerData, TowerLevel } from '../types';
import { Enemy } from './Enemy';
import { Projectile } from './Projectile';

export class Tower extends Phaser.GameObjects.Container {
  public towerData: TowerData;
  public level: number = 0;
  public spotId: string;

  private base: Phaser.GameObjects.Rectangle;
  private turret: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite;
  private rangeCircle: Phaser.GameObjects.Arc;
  private lastFireTime: number = 0;
  private projectiles: Projectile[] = [];
  private levelDots: Phaser.GameObjects.Arc[] = [];
  private hasCustomImage: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number, towerData: TowerData, spotId: string) {
    super(scene, x, y);
    this.towerData = towerData;
    this.spotId = spotId;

    // Stone base
    this.base = scene.add.rectangle(0, 4, 40, 36, 0x666666);
    this.base.setStrokeStyle(2, 0x444444);
    this.add(this.base);

    // Use custom image if available, otherwise colored rectangle turret
    const textureKey = `tower_${towerData.id}`;
    if (scene.textures.exists(textureKey)) {
      const spr = scene.add.sprite(0, -4, textureKey);
      spr.setDisplaySize(36, 36);
      this.turret = spr;
      this.hasCustomImage = true;
    } else {
      const rect = scene.add.rectangle(0, -6, 24, 24, towerData.tint);
      rect.setStrokeStyle(1, 0xffffff);
      this.turret = rect;
    }
    this.add(this.turret);

    // Range circle (hidden by default)
    const stats = this.getStats();
    this.rangeCircle = scene.add.circle(0, 0, stats.range, 0xffffff, 0.1);
    this.rangeCircle.setStrokeStyle(1, 0xffffff, 0.3);
    this.rangeCircle.setVisible(false);
    this.add(this.rangeCircle);

    this.updateLevelDots();

    // Make interactive
    this.setSize(44, 44);
    this.setInteractive();

    scene.add.existing(this);
  }

  getStats(): TowerLevel {
    return this.towerData.levels[this.level];
  }

  canUpgrade(): boolean {
    return this.level < this.towerData.maxLevel - 1;
  }

  getUpgradeCost(): number {
    if (!this.canUpgrade()) return 0;
    return this.towerData.levels[this.level + 1].cost;
  }

  getSellValue(): number {
    let total = 0;
    for (let i = 0; i <= this.level; i++) {
      total += this.towerData.levels[i].cost;
    }
    return Math.floor(total * 0.6);
  }

  upgrade() {
    if (!this.canUpgrade()) return;
    this.level++;
    const stats = this.getStats();
    this.rangeCircle.setRadius(stats.range);
    if (!this.hasCustomImage) {
      this.turret.setScale(1 + this.level * 0.15);
    }
    this.updateLevelDots();
  }

  showRange(visible: boolean) {
    this.rangeCircle.setVisible(visible);
  }

  tick(time: number, enemies: Enemy[]) {
    const stats = this.getStats();
    const fireInterval = 1000 / stats.fireRate;

    if (time - this.lastFireTime < fireInterval) return;

    const target = this.findTarget(enemies, stats.range);
    if (!target) return;

    this.lastFireTime = time;
    this.fire(target, stats);
  }

  tickProjectiles(delta: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.tick(delta);
      if (p.isDone) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  private findTarget(enemies: Enemy[], range: number): Enemy | null {
    let best: Enemy | null = null;
    let bestProgress = -1;

    for (const enemy of enemies) {
      if (enemy.isDead || !enemy.active) continue;
      const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
      if (dist > range) continue;
      if (enemy.pathProgress > bestProgress) {
        bestProgress = enemy.pathProgress;
        best = enemy;
      }
    }
    return best;
  }

  private fire(target: Enemy, stats: TowerLevel) {
    const isMagic = this.towerData.category === 'mage';
    const speed = stats.projectileSpeed ?? 300;
    const proj = new Projectile(
      this.scene,
      this.x,
      this.y - 6,
      target,
      stats.damage,
      speed,
      isMagic,
      this.towerData.tint,
      stats.special,
    );
    this.projectiles.push(proj);

    // Point turret at target
    const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    this.turret.setRotation(angle);
  }

  private updateLevelDots() {
    this.levelDots.forEach(d => d.destroy());
    this.levelDots = [];
    for (let i = 0; i <= this.level; i++) {
      const dot = this.scene.add.circle(-8 + i * 8, 18, 3, 0xffff00);
      this.add(dot);
      this.levelDots.push(dot);
    }
  }

  destroy(fromScene?: boolean) {
    this.projectiles.forEach(p => {
      if (p.active) p.destroy();
    });
    this.projectiles = [];
    super.destroy(fromScene);
  }
}
