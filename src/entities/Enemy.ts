import Phaser from 'phaser';
import type { EnemyData, Waypoint } from '../types';

export class Enemy extends Phaser.GameObjects.Container {
  public enemyData: EnemyData;
  public currentHealth: number;
  public maxHealth: number;
  public speed: number;
  public waypoints: Waypoint[];
  public waypointIndex: number = 0;
  public reward: number;
  public isDead: boolean = false;
  public pathProgress: number = 0; // 0-1 how far along path

  private sprite: Phaser.GameObjects.Arc | Phaser.GameObjects.Sprite;
  private healthBg: Phaser.GameObjects.Graphics;
  private stunTimer: number = 0;

  constructor(scene: Phaser.Scene, enemyData: EnemyData, waypoints: Waypoint[]) {
    const start = waypoints[0];
    super(scene, start.x, start.y);

    this.enemyData = enemyData;
    this.maxHealth = enemyData.health;
    this.currentHealth = this.maxHealth;
    this.speed = enemyData.speed;
    this.waypoints = waypoints;
    this.reward = enemyData.reward;

    // Use custom image if available, otherwise colored circle
    const textureKey = `enemy_${enemyData.id}`;
    if (scene.textures.exists(textureKey)) {
      const spr = scene.add.sprite(0, 0, textureKey);
      const targetSize = 24 * enemyData.size;
      spr.setDisplaySize(targetSize, targetSize);
      this.sprite = spr;
    } else {
      const radius = 12 * enemyData.size;
      const circle = scene.add.circle(0, 0, radius, enemyData.tint);
      circle.setStrokeStyle(2, 0x000000);
      if (enemyData.isBoss) {
        circle.setStrokeStyle(3, 0xff0000);
      }
      if (enemyData.isFlying) {
        circle.setStrokeStyle(2, 0xaaaaff);
      }
      this.sprite = circle;
    }
    this.add(this.sprite);

    // Health bar
    this.healthBg = scene.add.graphics();
    this.add(this.healthBg);
    this.drawHealthBar();

    scene.add.existing(this);
  }

  tick(delta: number) {
    if (this.isDead) return;

    if (this.stunTimer > 0) {
      this.stunTimer -= delta;
      return;
    }

    if (this.waypointIndex >= this.waypoints.length) return;

    const target = this.waypoints[this.waypointIndex];
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 4) {
      this.waypointIndex++;
      this.updatePathProgress();
      return;
    }

    const move = this.speed * (delta / 1000);
    this.x += (dx / dist) * move;
    this.y += (dy / dist) * move;
  }

  takeDamage(amount: number, isMagic: boolean = false): boolean {
    const resist = isMagic ? this.enemyData.magicResist : this.enemyData.armor;
    const actual = Math.max(1, amount - resist);
    this.currentHealth -= actual;
    this.drawHealthBar();

    if (this.currentHealth <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  stun(duration: number) {
    this.stunTimer = Math.max(this.stunTimer, duration * 1000);
  }

  hasReachedEnd(): boolean {
    return this.waypointIndex >= this.waypoints.length;
  }

  private die() {
    this.isDead = true;
    // Quick death flash
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 200,
      onComplete: () => this.destroy(),
    });
  }

  private drawHealthBar() {
    const g = this.healthBg;
    g.clear();
    const w = 28;
    const h = 4;
    const yOff = -20;

    // Background
    g.fillStyle(0x000000, 0.6);
    g.fillRect(-w / 2, yOff, w, h);

    // Health fill
    const pct = this.currentHealth / this.maxHealth;
    const color = pct > 0.5 ? 0x00ff00 : pct > 0.25 ? 0xffff00 : 0xff0000;
    g.fillStyle(color);
    g.fillRect(-w / 2, yOff, w * pct, h);
  }

  private updatePathProgress() {
    this.pathProgress = this.waypointIndex / Math.max(1, this.waypoints.length - 1);
  }
}
