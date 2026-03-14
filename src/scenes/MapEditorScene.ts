import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI, EDITOR_GRID_SIZE } from '../constants';
import { Button } from '../ui/Button';
import { DataManager } from '../utils/DataManager';
import type { MapData, WaveData, EnemyData } from '../types';

type EditorMode = 'path' | 'tower' | 'erase' | 'waves';

export class MapEditorScene extends Phaser.Scene {
  private mode: EditorMode = 'path';
  private mapData!: MapData;
  private currentPathIndex: number = 0;
  private gridSnap: boolean = true;
  private showGrid: boolean = true;

  private gridGfx!: Phaser.GameObjects.Graphics;
  private pathGfx!: Phaser.GameObjects.Graphics;
  private spotGfx!: Phaser.GameObjects.Graphics;
  private modeButtons: Button[] = [];
  private modeIndicator!: Phaser.GameObjects.Text;
  private mapNameText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;

  private spotCounter = 0;
  private nextPathId = 0;
  private pathLabels: Phaser.GameObjects.Text[] = [];

  // Wave editor state
  private waveContainer!: Phaser.GameObjects.Container;
  private allEnemyDefs!: EnemyData[];
  private selectedWaveIndex: number = 0;

  constructor() {
    super('MapEditor');
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.background);

    this.mapData = {
      id: 'custom_' + Date.now(),
      name: 'New Map',
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      startingGold: 250,
      startingLives: 20,
      towerSpots: [],
      paths: [{ id: 'path_0', waypoints: [] }],
      waves: [],
    };
    this.currentPathIndex = 0;
    this.nextPathId = 1;
    this.spotCounter = 0;
    this.selectedWaveIndex = 0;
    this.allEnemyDefs = DataManager.loadEnemies();

    // Grid overlay
    this.gridGfx = this.add.graphics().setDepth(0);
    this.drawGrid();

    // Drawing layers
    this.pathGfx = this.add.graphics().setDepth(1);
    this.spotGfx = this.add.graphics().setDepth(2);

    // Wave editor container (hidden by default)
    this.waveContainer = this.add.container(0, 0).setDepth(5).setVisible(false);

    this.createToolbar();
    this.setupInput();
  }

  private createToolbar() {
    const toolbarY = 24;
    this.add.rectangle(GAME_WIDTH / 2, toolbarY, GAME_WIDTH, 48, COLORS.hud, 0.9).setDepth(10);

    let bx = 20;
    const makeBtn = (label: string, cb: () => void, w = 80, color?: number) => {
      const btn = new Button(this, bx + w / 2, toolbarY, label, cb, w, 36, color);
      btn.setDepth(11);
      bx += w + 8;
      return btn;
    };

    // Mode buttons
    makeBtn('Path', () => this.setMode('path'), 65, 0x2196f3);
    makeBtn('Towers', () => this.setMode('tower'), 75, 0x4caf50);
    makeBtn('Waves', () => this.setMode('waves'), 70, 0xff9800);
    makeBtn('Erase', () => this.setMode('erase'), 65, COLORS.danger);

    // Path management
    makeBtn('New Path', () => {
      const pathId = 'path_' + this.nextPathId++;
      this.mapData.paths.push({ id: pathId, waypoints: [] });
      this.currentPathIndex = this.mapData.paths.length - 1;
      this.updateInfo();
      this.redraw();
    }, 85);

    // Path switcher (prev/next)
    makeBtn('< >', () => {
      if (this.mapData.paths.length < 2) return;
      this.currentPathIndex = (this.currentPathIndex + 1) % this.mapData.paths.length;
      this.updateInfo();
      this.redraw();
    }, 42);

    // Save / Download / Test / Back
    makeBtn('Save', () => this.saveMap(), 55, 0x4caf50);
    makeBtn('DL', () => this.downloadMap(), 38, 0x336688);
    makeBtn('Test', () => this.testMap(), 50, 0xff9800);
    makeBtn('Back', () => this.scene.start('MainMenu'), 50, COLORS.danger);

    // Mode indicator
    this.modeIndicator = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 40,
      'Mode: Path — tap to add waypoints', {
        fontSize: '14px', fontFamily: UI.fontFamily, color: '#ffffff',
        backgroundColor: '#00000088', padding: { x: 10, y: 4 },
      }).setOrigin(0.5).setDepth(10);

    // Map name
    this.mapNameText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 18,
      `Map: ${this.mapData.name}`, {
        fontSize: '12px', fontFamily: UI.fontFamily, color: '#aaaaaa',
      }).setOrigin(0.5).setDepth(10);

    // Info text
    this.infoText = this.add.text(GAME_WIDTH - 10, GAME_HEIGHT - 18, '', {
      fontSize: '12px', fontFamily: UI.fontFamily, color: '#888888',
    }).setOrigin(1, 0.5).setDepth(10);
    this.updateInfo();
  }

  private setMode(mode: EditorMode) {
    this.mode = mode;
    const labels: Record<EditorMode, string> = {
      path: 'Mode: Path — tap to add waypoints',
      tower: 'Mode: Towers — tap to place tower spots',
      erase: 'Mode: Erase — tap near items to remove them',
      waves: 'Mode: Waves — design enemy waves for this map',
    };
    this.modeIndicator.setText(labels[mode]);

    // Toggle map graphics vs wave editor
    const showMap = mode !== 'waves';
    this.gridGfx.setVisible(showMap && this.showGrid);
    this.pathGfx.setVisible(showMap);
    this.spotGfx.setVisible(showMap);
    this.waveContainer.setVisible(!showMap);

    if (mode === 'waves') {
      this.refreshWaveUI();
    }
  }

  private setupInput() {
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      // Ignore toolbar area and wave mode (wave mode uses its own UI)
      if (pointer.y < 48 || this.mode === 'waves') return;

      let x = pointer.worldX;
      let y = pointer.worldY;

      if (this.gridSnap) {
        x = Math.round(x / EDITOR_GRID_SIZE) * EDITOR_GRID_SIZE;
        y = Math.round(y / EDITOR_GRID_SIZE) * EDITOR_GRID_SIZE;
      }

      switch (this.mode) {
        case 'path':
          this.addWaypoint(x, y);
          break;
        case 'tower':
          this.addTowerSpot(x, y);
          break;
        case 'erase':
          this.eraseNear(x, y);
          break;
      }
    });
  }

  // ── Path & Tower Spot editing ──

  private addWaypoint(x: number, y: number) {
    const path = this.mapData.paths[this.currentPathIndex];
    if (!path) return;
    path.waypoints.push({ x, y });
    this.redraw();
    this.updateInfo();
  }

  private addTowerSpot(x: number, y: number) {
    const tooClose = this.mapData.towerSpots.some(s =>
      Phaser.Math.Distance.Between(s.x, s.y, x, y) < 30
    );
    if (tooClose) return;
    this.mapData.towerSpots.push({ id: 's' + (++this.spotCounter), x, y });
    this.redraw();
    this.updateInfo();
  }

  private eraseNear(x: number, y: number) {
    const threshold = 25;
    const spotIdx = this.mapData.towerSpots.findIndex(s =>
      Phaser.Math.Distance.Between(s.x, s.y, x, y) < threshold
    );
    if (spotIdx >= 0) {
      this.mapData.towerSpots.splice(spotIdx, 1);
      this.redraw();
      this.updateInfo();
      return;
    }
    for (const path of this.mapData.paths) {
      const wpIdx = path.waypoints.findIndex(wp =>
        Phaser.Math.Distance.Between(wp.x, wp.y, x, y) < threshold
      );
      if (wpIdx >= 0) {
        path.waypoints.splice(wpIdx, 1);
        this.redraw();
        this.updateInfo();
        return;
      }
    }
  }

  // ── Wave Editor UI ──

  private refreshWaveUI() {
    this.waveContainer.each((child: Phaser.GameObjects.GameObject) => child.destroy());
    this.waveContainer.removeAll();

    const waves = this.mapData.waves!;

    // Background panel
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 24, GAME_WIDTH - 20, GAME_HEIGHT - 68, 0x1a1a2e, 0.95);
    this.waveContainer.add(bg);

    // Wave list (left)
    const listX = 30;
    let listY = 70;

    const addWaveBtn = new Button(this, listX + 70, listY, '+ Add Wave', () => {
      const nextId = waves.length > 0 ? Math.max(...waves.map(w => w.id)) + 1 : 1;
      const defaultPath = this.mapData.paths[0]?.id ?? 'path_0';
      const defaultEnemy = this.allEnemyDefs[0]?.id ?? 'goblin';
      waves.push({
        id: nextId,
        enemies: [{ enemyId: defaultEnemy, count: 5, delay: 800, pathId: defaultPath }],
        reward: 25,
        delayBefore: 3000,
      });
      this.selectedWaveIndex = waves.length - 1;
      this.refreshWaveUI();
    }, 140, 30, 0x338833);
    this.waveContainer.add(addWaveBtn);
    listY += 40;

    // Wave list items
    waves.forEach((wave, i) => {
      const isSelected = i === this.selectedWaveIndex;
      const rowBg = this.add.rectangle(listX + 70, listY, 140, 32, isSelected ? 0x4466aa : 0x333355);
      rowBg.setStrokeStyle(1, isSelected ? 0x6688cc : 0x444466);
      rowBg.setInteractive({ useHandCursor: true });
      rowBg.on('pointerup', () => {
        this.selectedWaveIndex = i;
        this.refreshWaveUI();
      });
      this.waveContainer.add(rowBg);

      const totalEnemies = wave.enemies.reduce((sum, g) => sum + g.count, 0);
      const rowText = this.add.text(listX + 70, listY, `Wave ${wave.id} (${totalEnemies})`, {
        fontSize: '13px', fontFamily: UI.fontFamily, color: '#ffffff',
      }).setOrigin(0.5);
      this.waveContainer.add(rowText);
      listY += 38;
    });

    // Delete wave button
    if (waves.length > 0) {
      const delBtn = new Button(this, listX + 70, listY + 5, 'Delete Wave', () => {
        waves.splice(this.selectedWaveIndex, 1);
        this.selectedWaveIndex = Math.max(0, this.selectedWaveIndex - 1);
        this.refreshWaveUI();
      }, 140, 28, COLORS.danger);
      this.waveContainer.add(delBtn);
    }

    // Wave detail (right)
    if (waves.length > 0 && waves[this.selectedWaveIndex]) {
      this.drawWaveDetail(waves[this.selectedWaveIndex]);
    } else {
      const noWaves = this.add.text(GAME_WIDTH / 2 + 100, GAME_HEIGHT / 2,
        'No waves yet.\nClick "+ Add Wave" to create one.', {
          fontSize: '16px', fontFamily: UI.fontFamily, color: '#888888', align: 'center',
        }).setOrigin(0.5);
      this.waveContainer.add(noWaves);
    }
  }

  private drawWaveDetail(wave: WaveData) {
    const px = 220; // panel start x
    let y = 70;
    const h = 32;

    // Header
    const header = this.add.text(px, y, `Wave ${wave.id}`, {
      fontSize: '18px', fontFamily: UI.fontFamily, color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.waveContainer.add(header);
    y += h;

    // Delay before
    this.addNumericField(px, y, 'Delay Before (ms)', wave.delayBefore, 500,
      (v) => { wave.delayBefore = Math.max(0, v); });
    y += h;

    // Reward
    this.addNumericField(px, y, 'Wave Reward', wave.reward, 5,
      (v) => { wave.reward = Math.max(0, v); });
    y += h + 8;

    // Enemy groups header
    const groupHeader = this.add.text(px, y, 'Enemy Groups:', {
      fontSize: '15px', fontFamily: UI.fontFamily, color: '#ff9800', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.waveContainer.add(groupHeader);
    y += h;

    // Each enemy group
    wave.enemies.forEach((group, gi) => {
      // Group background
      const gBg = this.add.rectangle(px + 330, y + 40, 680, 100, 0x222244, 0.6);
      gBg.setStrokeStyle(1, 0x444466);
      this.waveContainer.add(gBg);

      // Enemy type selector
      const typeLabel = this.add.text(px + 10, y, `Enemy: ${group.enemyId}`, {
        fontSize: '13px', fontFamily: UI.fontFamily, color: '#ffffff',
      }).setOrigin(0, 0.5);
      this.waveContainer.add(typeLabel);

      const changeTypeBtn = this.add.text(px + 180, y, '[Change]', {
        fontSize: '12px', fontFamily: UI.fontFamily, color: '#4488ff',
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
      changeTypeBtn.on('pointerup', () => {
        const ids = this.allEnemyDefs.map(e => e.id).join(', ');
        const newId = prompt(`Enemy type (${ids}):`, group.enemyId);
        if (newId && this.allEnemyDefs.some(e => e.id === newId)) {
          group.enemyId = newId;
          this.refreshWaveUI();
        }
      });
      this.waveContainer.add(changeTypeBtn);
      y += h * 0.8;

      // Path selector — show actual map path IDs as tappable options
      const pathLabel = this.add.text(px + 10, y, 'Path:', {
        fontSize: '13px', fontFamily: UI.fontFamily, color: '#aaaaaa',
      }).setOrigin(0, 0.5);
      this.waveContainer.add(pathLabel);

      this.mapData.paths.forEach((p, pi) => {
        const isActive = group.pathId === p.id;
        const pathBtn = this.add.text(px + 60 + pi * 80, y, p.id, {
          fontSize: '12px', fontFamily: UI.fontFamily,
          color: isActive ? '#ffffff' : '#666666',
          backgroundColor: isActive ? '#4466aa' : '#333344',
          padding: { x: 6, y: 2 },
        }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
        pathBtn.on('pointerup', () => {
          group.pathId = p.id;
          this.refreshWaveUI();
        });
        this.waveContainer.add(pathBtn);
      });
      y += h * 0.8;

      // Count
      this.addNumericField(px + 10, y, 'Count', group.count, 1,
        (v) => { group.count = Math.max(1, v); });

      // Delay
      this.addNumericField(px + 300, y, 'Delay (ms)', group.delay, 100,
        (v) => { group.delay = Math.max(100, v); });
      y += h * 0.8;

      // Delete group
      const delGroup = this.add.text(px + 10, y, '[Remove Group]', {
        fontSize: '12px', fontFamily: UI.fontFamily, color: '#ff4444',
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
      delGroup.on('pointerup', () => {
        wave.enemies.splice(gi, 1);
        this.refreshWaveUI();
      });
      this.waveContainer.add(delGroup);
      y += h;
    });

    // Add group button
    y += 5;
    const defaultPath = this.mapData.paths[0]?.id ?? 'path_0';
    const defaultEnemy = this.allEnemyDefs[0]?.id ?? 'goblin';
    const addGroupBtn = new Button(this, px + 80, y, '+ Add Group', () => {
      wave.enemies.push({ enemyId: defaultEnemy, count: 5, delay: 800, pathId: defaultPath });
      this.refreshWaveUI();
    }, 140, 28, 0x338833);
    this.waveContainer.add(addGroupBtn);
  }

  private addNumericField(x: number, y: number, label: string, value: number, step: number,
    onSet: (newVal: number) => void) {
    const lbl = this.add.text(x, y, label + ':', {
      fontSize: '12px', fontFamily: UI.fontFamily, color: '#aaaaaa',
    }).setOrigin(0, 0.5);
    this.waveContainer.add(lbl);

    const valText = this.add.text(x + 150, y, String(value), {
      fontSize: '13px', fontFamily: UI.fontFamily, color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    this.waveContainer.add(valText);

    const minus = this.add.text(x + 115, y, ' - ', {
      fontSize: '16px', fontFamily: UI.fontFamily, color: '#ff8888',
      backgroundColor: '#444444', padding: { x: 3, y: 0 },
    }).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });
    minus.on('pointerup', () => { onSet(value - step); this.refreshWaveUI(); });
    this.waveContainer.add(minus);

    const plus = this.add.text(x + 185, y, ' + ', {
      fontSize: '16px', fontFamily: UI.fontFamily, color: '#88ff88',
      backgroundColor: '#444444', padding: { x: 3, y: 0 },
    }).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });
    plus.on('pointerup', () => { onSet(value + step); this.refreshWaveUI(); });
    this.waveContainer.add(plus);
  }

  // ── Drawing ──

  private redraw() {
    this.pathGfx.clear();

    // Destroy old path label texts
    this.pathLabels.forEach(t => t.destroy());
    this.pathLabels = [];

    // Per-path colors so they're visually distinct
    const pathColors = [0x44aaff, 0xff9944, 0x44ff88, 0xff44aa, 0xaaff44, 0x44ffff];

    this.mapData.paths.forEach((path, pi) => {
      const isCurrent = pi === this.currentPathIndex;
      const baseColor = pathColors[pi % pathColors.length];
      const pathAlpha = isCurrent ? 0.8 : 0.35;

      if (path.waypoints.length >= 2) {
        // Outer stroke (border)
        this.pathGfx.lineStyle(18, COLORS.pathBorder, pathAlpha * 0.6);
        this.pathGfx.beginPath();
        this.pathGfx.moveTo(path.waypoints[0].x, path.waypoints[0].y);
        for (let i = 1; i < path.waypoints.length; i++) {
          this.pathGfx.lineTo(path.waypoints[i].x, path.waypoints[i].y);
        }
        this.pathGfx.strokePath();

        // Inner path fill
        this.pathGfx.lineStyle(12, COLORS.path, pathAlpha);
        this.pathGfx.beginPath();
        this.pathGfx.moveTo(path.waypoints[0].x, path.waypoints[0].y);
        for (let i = 1; i < path.waypoints.length; i++) {
          this.pathGfx.lineTo(path.waypoints[i].x, path.waypoints[i].y);
        }
        this.pathGfx.strokePath();

        // Direction arrows along each segment midpoint
        for (let i = 0; i < path.waypoints.length - 1; i++) {
          const a = path.waypoints[i];
          const b = path.waypoints[i + 1];
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          const angle = Math.atan2(b.y - a.y, b.x - a.x);
          const sz = 6;
          this.pathGfx.fillStyle(0xffffff, pathAlpha * 0.7);
          this.pathGfx.fillTriangle(
            mx + Math.cos(angle) * sz, my + Math.sin(angle) * sz,
            mx + Math.cos(angle + 2.4) * sz, my + Math.sin(angle + 2.4) * sz,
            mx + Math.cos(angle - 2.4) * sz, my + Math.sin(angle - 2.4) * sz,
          );
        }
      }

      // Waypoint dots
      path.waypoints.forEach((wp, wi) => {
        const isStart = wi === 0;
        const isEnd = wi === path.waypoints.length - 1 && path.waypoints.length > 1;

        if (isStart) {
          // START — green marker
          this.pathGfx.fillStyle(0x00cc44, pathAlpha);
          this.pathGfx.fillCircle(wp.x, wp.y, 14);
          this.pathGfx.lineStyle(2, 0xffffff, pathAlpha);
          this.pathGfx.strokeCircle(wp.x, wp.y, 14);
        } else if (isEnd) {
          // END — red marker
          this.pathGfx.fillStyle(0xcc0000, pathAlpha);
          this.pathGfx.fillCircle(wp.x, wp.y, 14);
          this.pathGfx.lineStyle(2, 0xffffff, pathAlpha);
          this.pathGfx.strokeCircle(wp.x, wp.y, 14);
        } else {
          // Middle waypoint — normal dot
          this.pathGfx.fillStyle(baseColor, pathAlpha);
          this.pathGfx.fillCircle(wp.x, wp.y, 8);
          this.pathGfx.fillStyle(0xffffff, pathAlpha);
          this.pathGfx.fillCircle(wp.x, wp.y, 4);
        }
      });

      // Path label text near the start point
      if (path.waypoints.length > 0) {
        const start = path.waypoints[0];
        const label = this.add.text(start.x, start.y - 22, path.id, {
          fontSize: '11px', fontFamily: UI.fontFamily, fontStyle: 'bold',
          color: isCurrent ? '#ffffff' : '#999999',
          backgroundColor: isCurrent ? '#00000088' : '#00000044',
          padding: { x: 3, y: 1 },
        }).setOrigin(0.5).setDepth(3);
        this.pathLabels.push(label);
      }
    });

    this.spotGfx.clear();
    for (const spot of this.mapData.towerSpots) {
      this.spotGfx.lineStyle(2, COLORS.towerSpot, 0.8);
      this.spotGfx.strokeCircle(spot.x, spot.y, 20);
      this.spotGfx.fillStyle(COLORS.towerSpot, 0.2);
      this.spotGfx.fillCircle(spot.x, spot.y, 20);
    }
  }

  private drawGrid() {
    this.gridGfx.clear();
    if (!this.showGrid) return;
    this.gridGfx.lineStyle(1, 0xffffff, 0.08);
    for (let x = 0; x <= GAME_WIDTH; x += EDITOR_GRID_SIZE) {
      this.gridGfx.lineBetween(x, 48, x, GAME_HEIGHT);
    }
    for (let y = 48; y <= GAME_HEIGHT; y += EDITOR_GRID_SIZE) {
      this.gridGfx.lineBetween(0, y, GAME_WIDTH, y);
    }
  }

  // ── Settings / Save / Test ──

  private editSettings() {
    const name = prompt('Map name:', this.mapData.name);
    if (name) this.mapData.name = name;
    const gold = prompt('Starting gold:', String(this.mapData.startingGold));
    if (gold) this.mapData.startingGold = parseInt(gold) || 250;
    const lives = prompt('Starting lives:', String(this.mapData.startingLives));
    if (lives) this.mapData.startingLives = parseInt(lives) || 20;
    this.mapNameText.setText(`Map: ${this.mapData.name}`);
  }

  private saveMap() {
    this.mapData.paths = this.mapData.paths.filter(p => p.waypoints.length >= 2);
    if (this.mapData.paths.length === 0) {
      alert('Add at least one path with 2+ waypoints before saving.');
      return;
    }
    if (this.mapData.towerSpots.length === 0) {
      alert('Add at least one tower spot before saving.');
      return;
    }
    DataManager.saveCustomMap(this.mapData);
    alert(`Map "${this.mapData.name}" saved! (${this.mapData.waves?.length ?? 0} waves)`);
  }

  private downloadMap() {
    // Export this single map as JSON — ready to add to src/data/maps/ in the repo
    const cleanPaths = this.mapData.paths.filter(p => p.waypoints.length >= 2);
    if (cleanPaths.length === 0) {
      alert('Add at least one path before downloading.');
      return;
    }
    const exportData = { ...this.mapData, paths: cleanPaths };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Sanitize name for filename
    const safeName = this.mapData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    a.download = `${safeName || 'map'}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  private testMap() {
    this.mapData.paths = this.mapData.paths.filter(p => p.waypoints.length >= 2);
    if (this.mapData.paths.length === 0 || this.mapData.towerSpots.length === 0) {
      alert('Need at least one path (2+ waypoints) and one tower spot to test.');
      return;
    }
    this.scene.start('Game', { mapData: this.mapData });
  }

  private updateInfo() {
    const pathInfo = this.mapData.paths.map((p, i) =>
      `P${i + 1}:${p.waypoints.length}wp`
    ).join(' ');
    const waveCount = this.mapData.waves?.length ?? 0;
    this.infoText.setText(
      `${pathInfo} | ${this.mapData.towerSpots.length} spots | ${waveCount} waves | Path ${this.currentPathIndex + 1}/${this.mapData.paths.length}`
    );
  }
}
