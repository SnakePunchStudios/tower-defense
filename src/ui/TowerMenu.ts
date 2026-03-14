import Phaser from 'phaser';
import type { TowerData } from '../types';
import { Tower } from '../entities/Tower';
import { COLORS, UI } from '../constants';

export class TowerMenu extends Phaser.GameObjects.Container {
  private panel: Phaser.GameObjects.Rectangle;
  private items: Phaser.GameObjects.Container[] = [];

  public onBuild?: (towerData: TowerData, spotId: string) => void;
  public onUpgrade?: (tower: Tower) => void;
  public onSell?: (tower: Tower) => void;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.panel = scene.add.rectangle(0, 0, 200, 200, COLORS.hud, 0.9);
    this.panel.setStrokeStyle(2, 0x666666);
    this.add(this.panel);
    this.setVisible(false);
    this.setDepth(20);
    scene.add.existing(this);
  }

  showBuildMenu(x: number, y: number, spotId: string, towers: TowerData[], gold: number) {
    this.clear();
    const count = towers.length;
    const itemH = 48;
    const panelH = count * itemH + 20;

    // Position menu near spot but keep on screen
    const menuX = Math.min(Math.max(110, x), 960 - 110);
    const menuY = y < 300 ? y + panelH / 2 + 30 : y - panelH / 2 - 30;
    this.setPosition(menuX, menuY);
    this.panel.setSize(200, panelH);

    towers.forEach((tower, i) => {
      const cost = tower.levels[0].cost;
      const canAfford = gold >= cost;
      const row = this.createRow(
        0,
        -panelH / 2 + 10 + i * itemH + itemH / 2,
        tower,
        cost,
        canAfford,
        () => {
          this.onBuild?.(tower, spotId);
          this.hide();
        },
      );
      this.items.push(row);
    });

    this.setVisible(true);
  }

  showUpgradeMenu(x: number, y: number, tower: Tower, gold: number) {
    this.clear();
    const canUpgrade = tower.canUpgrade();
    const upgradeCost = tower.getUpgradeCost();
    const sellValue = tower.getSellValue();

    const panelH = canUpgrade ? 120 : 80;
    const menuX = Math.min(Math.max(110, x), 960 - 110);
    const menuY = y < 300 ? y + panelH / 2 + 30 : y - panelH / 2 - 30;
    this.setPosition(menuX, menuY);
    this.panel.setSize(200, panelH);

    const yStart = -panelH / 2 + 15;
    // Tower name and level
    const title = this.scene.add.text(0, yStart, `${tower.towerData.name} Lv.${tower.level + 1}`, {
      fontSize: '14px',
      fontFamily: UI.fontFamily,
      color: '#ffffff',
    }).setOrigin(0.5);
    const titleContainer = this.scene.add.container(0, 0, [title]);
    this.add(titleContainer);
    this.items.push(titleContainer);

    if (canUpgrade) {
      const canAfford = gold >= upgradeCost;
      const upgradeBtn = this.createButton(
        0, yStart + 32,
        `Upgrade ($${upgradeCost})`,
        canAfford ? 0x338833 : 0x666666,
        canAfford,
        () => { this.onUpgrade?.(tower); this.hide(); },
      );
      this.items.push(upgradeBtn);
    }

    const sellBtn = this.createButton(
      0, yStart + (canUpgrade ? 68 : 36),
      `Sell ($${sellValue})`,
      COLORS.danger,
      true,
      () => { this.onSell?.(tower); this.hide(); },
    );
    this.items.push(sellBtn);

    this.setVisible(true);
  }

  hide() {
    this.setVisible(false);
    this.clear();
  }

  private clear() {
    this.items.forEach(item => item.destroy());
    this.items = [];
  }

  private createRow(
    x: number, y: number,
    tower: TowerData, cost: number, canAfford: boolean,
    callback: () => void,
  ): Phaser.GameObjects.Container {
    const row = this.scene.add.container(x, y);

    const bg = this.scene.add.rectangle(0, 0, 180, 42, canAfford ? 0x333355 : 0x333333);
    bg.setStrokeStyle(1, 0x555555);
    row.add(bg);

    const icon = this.scene.add.rectangle(-70, 0, 20, 20, tower.tint);
    row.add(icon);

    const name = this.scene.add.text(-50, -10, tower.name, {
      fontSize: '13px', fontFamily: UI.fontFamily, color: '#ffffff',
    });
    row.add(name);

    const costText = this.scene.add.text(-50, 4, `$${cost}`, {
      fontSize: '12px', fontFamily: UI.fontFamily, color: canAfford ? '#ffd700' : '#ff4444',
    });
    row.add(costText);

    row.setSize(180, 42);
    if (canAfford) {
      row.setInteractive({ useHandCursor: true });
      row.on('pointerover', () => bg.setFillStyle(0x444477));
      row.on('pointerout', () => bg.setFillStyle(0x333355));
      row.on('pointerup', callback);
    } else {
      row.setAlpha(0.6);
    }

    this.add(row);
    return row;
  }

  private createButton(
    x: number, y: number, text: string,
    color: number, enabled: boolean, callback: () => void,
  ): Phaser.GameObjects.Container {
    const btn = this.scene.add.container(x, y);
    const bg = this.scene.add.rectangle(0, 0, 180, 30, color);
    bg.setStrokeStyle(1, 0x888888);
    btn.add(bg);

    const label = this.scene.add.text(0, 0, text, {
      fontSize: '13px', fontFamily: UI.fontFamily, color: '#ffffff',
    }).setOrigin(0.5);
    btn.add(label);

    btn.setSize(180, 30);
    if (enabled) {
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => bg.setFillStyle(Phaser.Display.Color.ValueToColor(color).brighten(20).color));
      btn.on('pointerout', () => bg.setFillStyle(color));
      btn.on('pointerup', callback);
    } else {
      btn.setAlpha(0.5);
    }

    this.add(btn);
    return btn;
  }
}
