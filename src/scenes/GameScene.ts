import Phaser from 'phaser';
import type { MapData, TowerData, GameState } from '../types';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI } from '../constants';
import { DataManager } from '../utils/DataManager';
import { Tower } from '../entities/Tower';
import { Hero } from '../entities/Hero';
import { Enemy } from '../entities/Enemy';
import { WaveManager } from '../systems/WaveManager';
import { TowerMenu } from '../ui/TowerMenu';
import { HeroPanel } from '../ui/HeroPanel';
import { Button } from '../ui/Button';

export class GameScene extends Phaser.Scene {
  private mapData!: MapData;
  private state!: GameState;
  private towers: Tower[] = [];
  private heroes: Hero[] = [];
  private towerDefs!: TowerData[];
  private waveManager!: WaveManager;
  private towerMenu!: TowerMenu;
  private heroPanel!: HeroPanel;
  private selectedHero: Hero | null = null;

  // HUD elements
  private goldText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private nextWaveBtn!: Button;
  private speedBtn!: Button;
  private gameOverOverlay?: Phaser.GameObjects.Container;

  // Track occupied spots
  private occupiedSpots: Set<string> = new Set();
  // Spot graphics for interaction
  private spotGraphics: Map<string, Phaser.GameObjects.Container> = new Map();

  constructor() {
    super('Game');
  }

  init(data: { mapData?: MapData }) {
    this.mapData = data.mapData ?? DataManager.loadMaps()[0];
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.towerDefs = DataManager.loadTowers();
    this.occupiedSpots.clear();
    this.spotGraphics.clear();
    this.towers = [];
    this.heroes = [];
    this.selectedHero = null;

    this.state = {
      gold: this.mapData.startingGold,
      lives: this.mapData.startingLives,
      currentWave: 0,
      totalWaves: DataManager.loadWaves().length,
      isPaused: false,
      speed: 1,
      isGameOver: false,
      isVictory: false,
    };

    this.drawMap();
    this.createTowerSpots();
    this.createHeroes();
    this.setupWaveManager();
    this.setupUI();
    this.setupInput();
  }

  update(time: number, delta: number) {
    if (this.state.isPaused || this.state.isGameOver) return;

    const scaledDelta = delta * this.state.speed;

    this.waveManager.tick(time, scaledDelta);

    const aliveEnemies = this.waveManager.getAliveEnemies();

    // Update towers
    for (const tower of this.towers) {
      tower.tick(time, aliveEnemies);
      tower.tickProjectiles(scaledDelta);
    }

    // Update heroes
    for (const hero of this.heroes) {
      hero.tick(time, scaledDelta, aliveEnemies);
    }

    // Update HUD
    this.heroPanel.tick();
    this.updateHUD();

    // Check win/lose
    if (this.state.lives <= 0 && !this.state.isGameOver) {
      this.state.isGameOver = true;
      this.showGameOver(false);
    }
    if (this.waveManager.allWavesComplete && !this.state.isGameOver) {
      this.state.isGameOver = true;
      this.state.isVictory = true;
      this.showGameOver(true);
    }
  }

  // ── Map Drawing ──

  private drawMap() {
    // Draw paths
    const pathGfx = this.add.graphics();
    for (const path of this.mapData.paths) {
      const wps = path.waypoints;
      if (wps.length < 2) continue;

      // Thick path border
      pathGfx.lineStyle(24, COLORS.pathBorder);
      pathGfx.beginPath();
      pathGfx.moveTo(wps[0].x, wps[0].y);
      for (let i = 1; i < wps.length; i++) {
        pathGfx.lineTo(wps[i].x, wps[i].y);
      }
      pathGfx.strokePath();

      // Inner path
      pathGfx.lineStyle(18, COLORS.path);
      pathGfx.beginPath();
      pathGfx.moveTo(wps[0].x, wps[0].y);
      for (let i = 1; i < wps.length; i++) {
        pathGfx.lineTo(wps[i].x, wps[i].y);
      }
      pathGfx.strokePath();
    }
    pathGfx.setDepth(0);

    // Entry/exit markers
    for (const path of this.mapData.paths) {
      const first = path.waypoints[0];
      const last = path.waypoints[path.waypoints.length - 1];
      this.add.circle(first.x, first.y, 8, 0x44ff44, 0.6).setDepth(0);
      this.add.circle(last.x, last.y, 8, 0xff4444, 0.6).setDepth(0);
    }
  }

  private createTowerSpots() {
    for (const spot of this.mapData.towerSpots) {
      const container = this.add.container(spot.x, spot.y);

      const circle = this.add.circle(0, 0, 22, COLORS.towerSpot, 0.3);
      circle.setStrokeStyle(2, COLORS.towerSpot, 0.6);
      container.add(circle);

      container.setSize(44, 44);
      container.setInteractive({ useHandCursor: true });
      container.setDepth(1);
      container.setData('spotId', spot.id);

      container.on('pointerover', () => {
        if (!this.occupiedSpots.has(spot.id)) {
          circle.setFillStyle(COLORS.towerSpotHover, 0.5);
        }
      });
      container.on('pointerout', () => {
        if (!this.occupiedSpots.has(spot.id)) {
          circle.setFillStyle(COLORS.towerSpot, 0.3);
        }
      });
      container.on('pointerup', () => {
        this.handleSpotTap(spot.id);
      });

      this.spotGraphics.set(spot.id, container);
    }
  }

  private createHeroes() {
    const heroDefs = DataManager.loadHeroes();

    heroDefs.slice(0, 2).forEach((heroDef, i) => {
      // Place heroes near the first path
      const firstPath = this.mapData.paths[0];
      const midPoint = firstPath.waypoints[Math.floor(firstPath.waypoints.length / 2)];
      const hero = new Hero(this, midPoint.x + 40 + i * 60, midPoint.y - 60, heroDef);
      hero.setDepth(4);
      this.heroes.push(hero);

      hero.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation();
        this.selectHero(hero);
      });
    });
  }

  // ── Wave Manager ──

  private setupWaveManager() {
    // Prefer per-map waves, fall back to global wave data
    const waves = this.mapData.waves?.length
      ? this.mapData.waves
      : DataManager.loadWaves();
    const enemies = DataManager.loadEnemies();
    this.state.totalWaves = waves.length;
    this.waveManager = new WaveManager(this, waves, enemies, this.mapData);

    this.waveManager.onEnemyKilled = (enemy: Enemy) => {
      this.state.gold += enemy.reward;
    };

    this.waveManager.onEnemyReachedEnd = () => {
      this.state.lives--;
      this.cameras.main.shake(200, 0.005);
    };

    this.waveManager.onWaveComplete = (idx: number) => {
      const wave = waves[idx];
      if (wave) this.state.gold += wave.reward;
      this.nextWaveBtn.setEnabled(true);
    };
  }

  // ── UI Setup ──

  private setupUI() {
    // HUD bar at top
    this.add.rectangle(GAME_WIDTH / 2, 20, GAME_WIDTH, 40, COLORS.hud, 0.85).setDepth(10);

    this.goldText = this.add.text(20, 12, '', {
      fontSize: '16px', fontFamily: UI.fontFamily, color: '#ffd700',
    }).setDepth(11);

    this.livesText = this.add.text(180, 12, '', {
      fontSize: '16px', fontFamily: UI.fontFamily, color: '#ff6666',
    }).setDepth(11);

    this.waveText = this.add.text(340, 12, '', {
      fontSize: '16px', fontFamily: UI.fontFamily, color: '#ffffff',
    }).setDepth(11);

    // Next Wave button
    this.nextWaveBtn = new Button(this, GAME_WIDTH - 120, 20, 'Next Wave', () => {
      if (this.waveManager.startNextWave()) {
        this.state.currentWave = this.waveManager.currentWaveIndex + 1;
        this.nextWaveBtn.setEnabled(false);
        // Wave announcement
        const announce = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60,
          `Wave ${this.state.currentWave}`, {
          fontSize: '36px', fontFamily: UI.fontFamily, fontStyle: 'bold',
          color: '#ffd700', stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(50);
        this.tweens.add({
          targets: announce, alpha: 0, y: announce.y - 40,
          duration: 2000, onComplete: () => announce.destroy(),
        });
      }
    }, 130, 32, 0x4caf50);
    this.nextWaveBtn.setDepth(11);

    // Speed button
    this.speedBtn = new Button(this, GAME_WIDTH - 260, 20, '1x', () => {
      this.state.speed = this.state.speed === 1 ? 2 : this.state.speed === 2 ? 3 : 1;
      this.speedBtn.setText(`${this.state.speed}x`);
    }, 50, 32);
    this.speedBtn.setDepth(11);

    // Pause button
    new Button(this, GAME_WIDTH - 320, 20, 'II', () => {
      this.state.isPaused = !this.state.isPaused;
    }, 40, 32).setDepth(11);

    // Menu button
    new Button(this, 60, GAME_HEIGHT - 20, 'Menu', () => {
      this.waveManager.destroy();
      this.scene.start('MainMenu');
    }, 80, 32).setDepth(11);

    // Tower build/upgrade menu
    this.towerMenu = new TowerMenu(this);
    this.towerMenu.onBuild = (towerData, spotId) => this.buildTower(towerData, spotId);
    this.towerMenu.onUpgrade = (tower) => this.upgradeTower(tower);
    this.towerMenu.onSell = (tower) => this.sellTower(tower);

    // Hero panel
    this.heroPanel = new HeroPanel(this);
    this.heroPanel.setup(this.heroes);
    this.heroPanel.onHeroSelected = (hero) => this.selectHero(hero);
    this.heroPanel.onAbilityUsed = (hero, idx) => {
      const ability = hero.heroData.abilities[idx];
      if (ability) {
        hero.useAbility(ability, this.waveManager.getAliveEnemies());
      }
    };

    this.updateHUD();
  }

  private setupInput() {
    // Tap on map to move hero or dismiss menus
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      // Check if we tapped on something interactive
      const hitObjects = this.input.hitTestPointer(pointer);
      const hitSomething = hitObjects.some(obj =>
        obj instanceof Phaser.GameObjects.Container || obj instanceof Phaser.GameObjects.Rectangle
      );

      if (!hitSomething) {
        // Move selected hero
        if (this.selectedHero && !this.selectedHero.isDead) {
          this.selectedHero.moveToPosition(pointer.worldX, pointer.worldY);
          // Tap indicator
          const ring = this.add.circle(pointer.worldX, pointer.worldY, 10, 0xffff00, 0.5);
          this.tweens.add({
            targets: ring, alpha: 0, scaleX: 2, scaleY: 2,
            duration: 400, onComplete: () => ring.destroy(),
          });
        }
        this.towerMenu.hide();
      }
    });
  }

  // ── Tower Actions ──

  private handleSpotTap(spotId: string) {
    this.towerMenu.hide();

    // If tower exists here, show upgrade menu
    const existingTower = this.towers.find(t => t.spotId === spotId);
    if (existingTower) {
      existingTower.showRange(true);
      this.time.delayedCall(2000, () => existingTower.showRange(false));
      this.towerMenu.showUpgradeMenu(existingTower.x, existingTower.y, existingTower, this.state.gold);
      return;
    }

    // Show build menu
    const spot = this.mapData.towerSpots.find(s => s.id === spotId);
    if (!spot) return;

    const available = this.towerDefs.filter(t => {
      if (spot.allowedTypes && !spot.allowedTypes.includes(t.id)) return false;
      return true;
    });
    this.towerMenu.showBuildMenu(spot.x, spot.y, spotId, available, this.state.gold);
  }

  private buildTower(towerData: TowerData, spotId: string) {
    const spot = this.mapData.towerSpots.find(s => s.id === spotId);
    if (!spot) return;

    const cost = towerData.levels[0].cost;
    if (this.state.gold < cost) return;

    this.state.gold -= cost;
    this.occupiedSpots.add(spotId);

    const tower = new Tower(this, spot.x, spot.y, towerData, spotId);
    tower.setDepth(3);
    this.towers.push(tower);

    // Hide the spot indicator
    const spotGfx = this.spotGraphics.get(spotId);
    if (spotGfx) spotGfx.setVisible(false);

    // Tower click to show upgrade menu
    tower.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      this.handleSpotTap(spotId);
    });
  }

  private upgradeTower(tower: Tower) {
    const cost = tower.getUpgradeCost();
    if (this.state.gold < cost || !tower.canUpgrade()) return;

    this.state.gold -= cost;
    tower.upgrade();
  }

  private sellTower(tower: Tower) {
    this.state.gold += tower.getSellValue();
    this.occupiedSpots.delete(tower.spotId);

    // Show spot indicator again
    const spotGfx = this.spotGraphics.get(tower.spotId);
    if (spotGfx) spotGfx.setVisible(true);

    const idx = this.towers.indexOf(tower);
    if (idx >= 0) this.towers.splice(idx, 1);
    tower.destroy();
  }

  // ── Hero Selection ──

  private selectHero(hero: Hero) {
    this.heroes.forEach(h => h.setSelected(false));
    hero.setSelected(true);
    this.selectedHero = hero;
  }

  // ── HUD ──

  private updateHUD() {
    this.goldText.setText(`Gold: ${this.state.gold}`);
    this.livesText.setText(`Lives: ${this.state.lives}`);
    this.waveText.setText(`Wave: ${this.state.currentWave}/${this.state.totalWaves}`);
  }

  // ── Game Over ──

  private showGameOver(victory: boolean) {
    this.gameOverOverlay = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(100);

    const bg = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7);
    this.gameOverOverlay.add(bg);

    const title = this.add.text(0, -60, victory ? 'VICTORY!' : 'DEFEAT', {
      fontSize: '48px',
      fontFamily: UI.fontFamily,
      fontStyle: 'bold',
      color: victory ? '#ffd700' : '#ff4444',
    }).setOrigin(0.5);
    this.gameOverOverlay.add(title);

    const stats = this.add.text(0, 0,
      `Waves Completed: ${this.state.currentWave}\nGold Remaining: ${this.state.gold}`, {
      fontSize: '18px',
      fontFamily: UI.fontFamily,
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5);
    this.gameOverOverlay.add(stats);

    new Button(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60, 'Play Again', () => {
      this.waveManager.destroy();
      this.scene.restart({ mapData: this.mapData });
    }, 160, 44, 0x4caf50).setDepth(101);

    new Button(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 115, 'Main Menu', () => {
      this.waveManager.destroy();
      this.scene.start('MainMenu');
    }, 160, 44).setDepth(101);
  }
}
