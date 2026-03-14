import Phaser from 'phaser';
import type { HeroData, HeroAbility } from '../types';
import { Enemy } from './Enemy';

export class Hero extends Phaser.GameObjects.Container {
  public heroData: HeroData;
  public currentHealth: number;
  public maxHealth: number;
  public mana: number;
  public maxMana: number = 100;
  public isSelected: boolean = false;
  public isDead: boolean = false;
  public respawnTimer: number = 0;
  public abilityCooldowns: Map<string, number> = new Map();

  private sprite: Phaser.GameObjects.Polygon | Phaser.GameObjects.Sprite;
  private healthBar: Phaser.GameObjects.Graphics;
  private manaBar: Phaser.GameObjects.Graphics;
  private selectionRing: Phaser.GameObjects.Arc;
  private lastAttackTime: number = 0;
  private moveTarget: { x: number; y: number } | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, heroData: HeroData) {
    super(scene, x, y);

    this.heroData = heroData;
    this.maxHealth = heroData.health;
    this.currentHealth = this.maxHealth;
    this.mana = this.maxMana;

    // Selection ring (hidden by default)
    this.selectionRing = scene.add.circle(0, 0, 22, 0xffffff, 0.0);
    this.selectionRing.setStrokeStyle(2, 0xffff00, 0);
    this.add(this.selectionRing);

    // Use custom image if available, otherwise diamond polygon
    const textureKey = `hero_${heroData.id}`;
    if (scene.textures.exists(textureKey)) {
      const spr = scene.add.sprite(0, 0, textureKey);
      const targetSize = 28 * heroData.size;
      spr.setDisplaySize(targetSize, targetSize);
      this.sprite = spr;
    } else {
      const s = 14 * heroData.size;
      const poly = scene.add.polygon(0, 0, [0, -s, s, 0, 0, s, -s, 0], heroData.tint);
      poly.setStrokeStyle(2, 0xffffff);
      this.sprite = poly;
    }
    this.add(this.sprite);

    // Health bar
    this.healthBar = scene.add.graphics();
    this.add(this.healthBar);

    // Mana bar
    this.manaBar = scene.add.graphics();
    this.add(this.manaBar);

    this.drawBars();

    // Initialize cooldowns
    for (const ability of heroData.abilities) {
      this.abilityCooldowns.set(ability.id, 0);
    }

    this.setSize(44, 44);
    this.setInteractive();
    scene.add.existing(this);
  }

  setSelected(selected: boolean) {
    this.isSelected = selected;
    this.selectionRing.setStrokeStyle(2, 0xffff00, selected ? 0.8 : 0);
  }

  moveToPosition(x: number, y: number) {
    this.moveTarget = { x, y };
  }

  useAbility(ability: HeroAbility, enemies: Enemy[]) {
    const cd = this.abilityCooldowns.get(ability.id) ?? 0;
    if (cd > 0 || this.mana < ability.manaCost) return false;

    this.mana -= ability.manaCost;
    this.abilityCooldowns.set(ability.id, ability.cooldown * 1000);

    // Execute ability effect
    if (ability.effect === 'damage' || ability.effect === 'aoe') {
      const radius = ability.radius ?? 60;
      for (const enemy of enemies) {
        if (enemy.isDead) continue;
        const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
        if (dist <= radius) {
          enemy.takeDamage(ability.damage ?? 0, true);
          if (ability.duration) enemy.stun(ability.duration);
        }
      }
      // Visual flash
      this.scene.add.circle(this.x, this.y, radius, ability.tint, 0.3)
        .setDepth(5)
        .setAlpha(0.5);
      this.scene.tweens.add({
        targets: this.scene.children.list[this.scene.children.list.length - 1],
        alpha: 0,
        scaleX: 1.5,
        scaleY: 1.5,
        duration: 400,
        onComplete: (_, targets) => targets[0]?.destroy(),
      });
    }

    this.drawBars();
    return true;
  }

  tick(time: number, delta: number, enemies: Enemy[]) {
    if (this.isDead) {
      this.respawnTimer -= delta;
      if (this.respawnTimer <= 0) {
        this.respawn();
      }
      return;
    }

    // Regenerate mana
    this.mana = Math.min(this.maxMana, this.mana + 5 * (delta / 1000));

    // Update cooldowns
    for (const [id, cd] of this.abilityCooldowns) {
      if (cd > 0) this.abilityCooldowns.set(id, Math.max(0, cd - delta));
    }

    // Move toward target
    if (this.moveTarget) {
      const dx = this.moveTarget.x - this.x;
      const dy = this.moveTarget.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 5) {
        this.moveTarget = null;
      } else {
        const move = this.heroData.moveSpeed * (delta / 1000);
        this.x += (dx / dist) * move;
        this.y += (dy / dist) * move;
      }
    }

    // Auto-attack nearest enemy
    const attackInterval = 1000 / this.heroData.attackSpeed;
    if (time - this.lastAttackTime >= attackInterval) {
      const target = this.findNearestEnemy(enemies);
      if (target) {
        target.takeDamage(this.heroData.damage);
        this.lastAttackTime = time;

        // Visual attack flash
        const line = this.scene.add.line(
          0, 0,
          this.x, this.y,
          target.x, target.y,
          this.heroData.tint, 0.6,
        ).setOrigin(0, 0).setDepth(3);
        this.scene.tweens.add({
          targets: line,
          alpha: 0,
          duration: 150,
          onComplete: () => line.destroy(),
        });
      }
    }

    this.drawBars();
  }

  takeDamage(amount: number) {
    const actual = Math.max(1, amount - this.heroData.armor);
    this.currentHealth -= actual;

    if (this.currentHealth <= 0) {
      this.die();
    }
    this.drawBars();
  }

  private die() {
    this.isDead = true;
    this.respawnTimer = 10000; // 10 second respawn
    this.setVisible(false);
    this.disableInteractive();
  }

  private respawn() {
    this.isDead = false;
    this.currentHealth = this.maxHealth;
    this.mana = this.maxMana;
    this.setVisible(true);
    this.setInteractive();
    this.drawBars();
  }

  private findNearestEnemy(enemies: Enemy[]): Enemy | null {
    let best: Enemy | null = null;
    let bestDist = this.heroData.range;

    for (const enemy of enemies) {
      if (enemy.isDead || !enemy.active) continue;
      const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = enemy;
      }
    }
    return best;
  }

  private drawBars() {
    const w = 30;
    const h = 3;
    const yBase = -24;

    // Health
    this.healthBar.clear();
    this.healthBar.fillStyle(0x000000, 0.6);
    this.healthBar.fillRect(-w / 2, yBase, w, h);
    const hpPct = Math.max(0, this.currentHealth / this.maxHealth);
    this.healthBar.fillStyle(hpPct > 0.5 ? 0x00ff00 : 0xff4444);
    this.healthBar.fillRect(-w / 2, yBase, w * hpPct, h);

    // Mana
    this.manaBar.clear();
    this.manaBar.fillStyle(0x000000, 0.6);
    this.manaBar.fillRect(-w / 2, yBase + h + 1, w, h);
    const manaPct = this.mana / this.maxMana;
    this.manaBar.fillStyle(0x4488ff);
    this.manaBar.fillRect(-w / 2, yBase + h + 1, w * manaPct, h);
  }
}
