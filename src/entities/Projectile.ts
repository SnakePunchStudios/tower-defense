import Phaser from 'phaser';
import type { Enemy } from './Enemy';
import type { TowerSpecial } from '../types';

export class Projectile extends Phaser.GameObjects.Arc {
  public target: Enemy;
  public damage: number;
  public speed: number;
  public isMagic: boolean;
  public special?: TowerSpecial;
  public isDone: boolean = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    target: Enemy,
    damage: number,
    speed: number,
    isMagic: boolean = false,
    tint: number = 0xffffff,
    special?: TowerSpecial,
  ) {
    super(scene, x, y, 4, 0, 360, false, tint);
    this.target = target;
    this.damage = damage;
    this.speed = speed;
    this.isMagic = isMagic;
    this.special = special;
    scene.add.existing(this);
  }

  tick(delta: number) {
    if (this.isDone) return;

    // If target is destroyed, remove projectile
    if (!this.target || this.target.isDead || !this.target.active) {
      this.isDone = true;
      this.destroy();
      return;
    }

    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 10) {
      this.hit();
      return;
    }

    const move = this.speed * (delta / 1000);
    this.x += (dx / dist) * move;
    this.y += (dy / dist) * move;
  }

  private hit() {
    this.isDone = true;
    this.target.takeDamage(this.damage, this.isMagic);

    // Splash damage
    if (this.special?.type === 'splash' && this.special.radius) {
      const enemies = this.scene.children.list.filter(
        (obj): obj is Enemy =>
          obj !== this.target &&
          obj instanceof Phaser.GameObjects.Container &&
          'enemyData' in obj &&
          !(obj as Enemy).isDead,
      ) as Enemy[];

      for (const enemy of enemies) {
        const d = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
        if (d <= this.special.radius) {
          enemy.takeDamage(this.special.value, this.isMagic);
        }
      }
    }

    this.destroy();
  }
}
