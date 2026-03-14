import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI, PRESET_COLORS } from '../constants';
import { DataManager } from '../utils/DataManager';
import { Button } from '../ui/Button';
import { pickAndResizeImage, registerBase64Texture } from '../utils/ImageUpload';
import type { TowerData, EnemyData, HeroData, WaveData } from '../types';

type EditorTab = 'towers' | 'enemies' | 'heroes' | 'waves';

export class DataEditorScene extends Phaser.Scene {
  private activeTab: EditorTab = 'towers';
  private selectedIndex: number = 0;

  // Current data arrays
  private towers!: TowerData[];
  private enemies!: EnemyData[];
  private heroes!: HeroData[];
  private waves!: WaveData[];

  // UI containers
  private tabButtons: Button[] = [];
  private listContainer!: Phaser.GameObjects.Container;
  private editContainer!: Phaser.GameObjects.Container;
  private scrollY: number = 0;

  constructor() {
    super('DataEditor');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x1a1a2e);
    this.loadData();
    this.selectedIndex = 0;

    // Header
    this.add.rectangle(GAME_WIDTH / 2, 24, GAME_WIDTH, 48, COLORS.hud, 0.95).setDepth(10);
    this.add.text(20, 16, 'Data Editor', {
      fontSize: '18px', fontFamily: UI.fontFamily, fontStyle: 'bold', color: '#ffd700',
    }).setDepth(11);

    // Back button
    new Button(this, GAME_WIDTH - 50, 24, 'Back', () => this.scene.start('MainMenu'), 70, 32, COLORS.danger)
      .setDepth(11);

    // Tab buttons
    this.createTabs();

    // List panel (left side)
    this.listContainer = this.add.container(0, 0).setDepth(5);

    // Edit panel (right side)
    this.editContainer = this.add.container(0, 0).setDepth(5);

    this.refreshUI();
  }

  private loadData() {
    this.towers = DataManager.loadTowers();
    this.enemies = DataManager.loadEnemies();
    this.heroes = DataManager.loadHeroes();
    this.waves = DataManager.loadWaves();
  }

  private createTabs() {
    const tabs: { label: string; tab: EditorTab }[] = [
      { label: 'Towers', tab: 'towers' },
      { label: 'Enemies', tab: 'enemies' },
      { label: 'Heroes', tab: 'heroes' },
      { label: 'Waves', tab: 'waves' },
    ];

    tabs.forEach((t, i) => {
      const btn = new Button(this, 160 + i * 100, 24, t.label, () => {
        this.activeTab = t.tab;
        this.selectedIndex = 0;
        this.refreshUI();
      }, 90, 32, this.activeTab === t.tab ? 0x4488aa : COLORS.buttonNormal);
      btn.setDepth(11);
      this.tabButtons.push(btn);
    });
  }

  private refreshUI() {
    this.clearContainer(this.listContainer);
    this.clearContainer(this.editContainer);
    this.scrollY = 0;

    // Update tab colors
    const tabOrder: EditorTab[] = ['towers', 'enemies', 'heroes', 'waves'];
    this.tabButtons.forEach((btn, i) => {
      (btn.list[0] as Phaser.GameObjects.Rectangle).setFillStyle(
        this.activeTab === tabOrder[i] ? 0x4488aa : COLORS.buttonNormal
      );
    });

    this.drawList();
    this.drawEditPanel();
  }

  private drawList() {
    const items = this.getItems();
    const startY = 70;
    const itemH = 40;

    // Panel background
    const panelBg = this.add.rectangle(120, GAME_HEIGHT / 2 + 24, 240, GAME_HEIGHT - 48, 0x222244, 0.9);
    this.listContainer.add(panelBg);

    // New button
    const newBtn = new Button(this, 120, startY, '+ New', () => this.addNewItem(), 220, 32, 0x338833);
    this.listContainer.add(newBtn);

    items.forEach((item, i) => {
      const y = startY + 40 + i * itemH;
      const isSelected = i === this.selectedIndex;

      const bg = this.add.rectangle(120, y, 220, 36, isSelected ? 0x4466aa : 0x333355);
      bg.setStrokeStyle(1, isSelected ? 0x6688cc : 0x444466);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerup', () => {
        this.selectedIndex = i;
        this.refreshUI();
      });
      this.listContainer.add(bg);

      // Color swatch
      const color = this.getItemColor(item);
      const swatch = this.add.rectangle(30, y, 20, 20, color);
      this.listContainer.add(swatch);

      // Name
      const name = this.add.text(50, y, this.getItemName(item), {
        fontSize: '13px', fontFamily: UI.fontFamily, color: '#ffffff',
      }).setOrigin(0, 0.5);
      this.listContainer.add(name);
    });
  }

  private drawEditPanel() {
    const items = this.getItems();
    if (items.length === 0) {
      const msg = this.add.text(GAME_WIDTH / 2 + 100, 200, 'No items. Click "+ New" to create one.', {
        fontSize: '16px', fontFamily: UI.fontFamily, color: '#888888',
      }).setOrigin(0.5);
      this.editContainer.add(msg);
      return;
    }

    const item = items[this.selectedIndex];
    if (!item) return;

    const panelX = 480;
    const panelW = GAME_WIDTH - 250;

    // Panel background
    const bg = this.add.rectangle(panelX + panelW / 2 - 10, GAME_HEIGHT / 2 + 24, panelW, GAME_HEIGHT - 48, 0x222244, 0.9);
    this.editContainer.add(bg);

    let y = 80;
    const rowH = 34;

    switch (this.activeTab) {
      case 'towers':
        y = this.drawTowerEditor(item as TowerData, panelX, y, rowH);
        break;
      case 'enemies':
        y = this.drawEnemyEditor(item as EnemyData, panelX, y, rowH);
        break;
      case 'heroes':
        y = this.drawHeroEditor(item as HeroData, panelX, y, rowH);
        break;
      case 'waves':
        y = this.drawWaveEditor(item as WaveData, panelX, y, rowH);
        break;
    }

    // Save + Delete buttons at bottom
    y += 10;
    const saveBtn = new Button(this, panelX + 80, y, 'Save All', () => this.saveData(), 120, 36, 0x4caf50);
    this.editContainer.add(saveBtn);

    const delBtn = new Button(this, panelX + 220, y, 'Delete', () => {
      if (confirm(`Delete this ${this.activeTab.slice(0, -1)}?`)) {
        this.deleteItem(this.selectedIndex);
      }
    }, 100, 36, COLORS.danger);
    this.editContainer.add(delBtn);

    const resetBtn = new Button(this, panelX + 360, y, 'Reset Defaults', () => {
      if (confirm(`Reset all ${this.activeTab} to defaults?`)) {
        DataManager.resetCategory(this.activeTab);
        this.loadData();
        this.selectedIndex = 0;
        this.refreshUI();
      }
    }, 140, 36);
    this.editContainer.add(resetBtn);
  }

  // ── Field Helpers ──

  private addField(x: number, y: number, label: string, value: string | number, onChange: (val: number) => void, step: number = 1): number {
    const lbl = this.add.text(x, y, label, {
      fontSize: '13px', fontFamily: UI.fontFamily, color: '#aaaaaa',
    }).setOrigin(0, 0.5);
    this.editContainer.add(lbl);

    const valText = this.add.text(x + 160, y, String(value), {
      fontSize: '14px', fontFamily: UI.fontFamily, color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    this.editContainer.add(valText);

    // Minus button
    const minus = this.add.text(x + 120, y, '  -  ', {
      fontSize: '16px', fontFamily: UI.fontFamily, color: '#ff8888',
      backgroundColor: '#444444', padding: { x: 2, y: 0 },
    }).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });
    minus.on('pointerup', () => {
      onChange(-step);
      this.refreshUI();
    });
    this.editContainer.add(minus);

    // Plus button
    const plus = this.add.text(x + 200, y, '  +  ', {
      fontSize: '16px', fontFamily: UI.fontFamily, color: '#88ff88',
      backgroundColor: '#444444', padding: { x: 2, y: 0 },
    }).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });
    plus.on('pointerup', () => {
      onChange(step);
      this.refreshUI();
    });
    this.editContainer.add(plus);

    return y;
  }

  private addNameField(x: number, y: number, name: string, onRename: (newName: string) => void): number {
    const lbl = this.add.text(x, y, `Name: ${name}`, {
      fontSize: '15px', fontFamily: UI.fontFamily, color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.editContainer.add(lbl);

    const editBtn = this.add.text(x + 280, y, '[Edit]', {
      fontSize: '13px', fontFamily: UI.fontFamily, color: '#4488ff',
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    editBtn.on('pointerup', () => {
      const newName = prompt('Enter name:', name);
      if (newName) {
        onRename(newName);
        this.refreshUI();
      }
    });
    this.editContainer.add(editBtn);

    return y;
  }

  private addColorPicker(x: number, y: number, currentTint: number, onPick: (color: number) => void): number {
    const lbl = this.add.text(x, y, 'Color:', {
      fontSize: '13px', fontFamily: UI.fontFamily, color: '#aaaaaa',
    }).setOrigin(0, 0.5);
    this.editContainer.add(lbl);

    PRESET_COLORS.forEach((color, i) => {
      const col = i % 8;
      const row = Math.floor(i / 8);
      const swatch = this.add.rectangle(x + 60 + col * 28, y + row * 24, 22, 18, color);
      swatch.setStrokeStyle(color === currentTint ? 2 : 1, color === currentTint ? 0xffffff : 0x666666);
      swatch.setInteractive({ useHandCursor: true });
      swatch.on('pointerup', () => {
        onPick(color);
        this.refreshUI();
      });
      this.editContainer.add(swatch);
    });

    return y + (PRESET_COLORS.length > 8 ? 30 : 0);
  }

  private addImageUpload(
    x: number, y: number,
    currentImage: string | undefined,
    textureKey: string,
    onChange: (dataUrl: string | undefined) => void,
  ): number {
    const lbl = this.add.text(x, y, 'Image:', {
      fontSize: '13px', fontFamily: UI.fontFamily, color: '#aaaaaa',
    }).setOrigin(0, 0.5);
    this.editContainer.add(lbl);

    if (currentImage) {
      // Show small preview thumbnail
      if (this.textures.exists(textureKey)) {
        const preview = this.add.sprite(x + 80, y, textureKey);
        preview.setDisplaySize(28, 28);
        this.editContainer.add(preview);
      } else {
        const placeholder = this.add.rectangle(x + 80, y, 28, 28, 0x444488);
        placeholder.setStrokeStyle(1, 0x6666aa);
        this.editContainer.add(placeholder);
      }

      // Remove button
      const removeBtn = this.add.text(x + 110, y, 'Remove', {
        fontSize: '12px', fontFamily: UI.fontFamily, color: '#ff6666',
        backgroundColor: '#442222', padding: { x: 4, y: 2 },
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
      removeBtn.on('pointerup', () => {
        onChange(undefined);
        if (this.textures.exists(textureKey)) {
          this.textures.remove(textureKey);
        }
        this.refreshUI();
      });
      this.editContainer.add(removeBtn);
    }

    // Upload button
    const uploadBtn = new Button(this, x + (currentImage ? 240 : 120), y,
      currentImage ? 'Change' : 'Upload Image', () => {
      pickAndResizeImage(64).then(async (dataUrl) => {
        if (dataUrl) {
          onChange(dataUrl);
          // Register texture immediately for live preview
          await registerBase64Texture(this, textureKey, dataUrl);
          this.refreshUI();
        }
      });
    }, currentImage ? 80 : 120, 26, 0x336688);
    this.editContainer.add(uploadBtn);

    return y;
  }

  // ── Tab-specific editors ──

  private drawTowerEditor(tower: TowerData, x: number, y: number, h: number): number {
    y = this.addNameField(x, y, tower.name, (n) => { tower.name = n; });
    y += h;
    y = this.addColorPicker(x, y, tower.tint, (c) => { tower.tint = c; });
    y += h + 10;

    // Image upload
    y = this.addImageUpload(x, y, tower.imageData, `tower_${tower.id}`, (dataUrl) => {
      tower.imageData = dataUrl;
    });
    y += h;

    // Description
    const descLbl = this.add.text(x, y, `Desc: ${tower.description}`, {
      fontSize: '12px', fontFamily: UI.fontFamily, color: '#888888',
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    descLbl.on('pointerup', () => {
      const d = prompt('Description:', tower.description);
      if (d) { tower.description = d; this.refreshUI(); }
    });
    this.editContainer.add(descLbl);
    y += h;

    // Levels
    tower.levels.forEach((level, li) => {
      const header = this.add.text(x, y, `Level ${li + 1}:`, {
        fontSize: '14px', fontFamily: UI.fontFamily, color: '#ffcc00', fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      this.editContainer.add(header);
      y += h * 0.8;

      this.addField(x + 10, y, 'Damage', level.damage, (d) => { level.damage = Math.max(1, level.damage + d); });
      y += h * 0.8;
      this.addField(x + 10, y, 'Range', level.range, (d) => { level.range = Math.max(10, level.range + d); }, 10);
      y += h * 0.8;
      this.addField(x + 10, y, 'Fire Rate', level.fireRate, (d) => { level.fireRate = Math.max(0.1, Math.round((level.fireRate + d * 0.1) * 10) / 10); }, 1);
      y += h * 0.8;
      this.addField(x + 10, y, 'Cost', level.cost, (d) => { level.cost = Math.max(5, level.cost + d); }, 5);
      y += h;
    });

    return y;
  }

  private drawEnemyEditor(enemy: EnemyData, x: number, y: number, h: number): number {
    y = this.addNameField(x, y, enemy.name, (n) => { enemy.name = n; });
    y += h;
    y = this.addColorPicker(x, y, enemy.tint, (c) => { enemy.tint = c; });
    y += h + 10;

    // Image upload
    y = this.addImageUpload(x, y, enemy.imageData, `enemy_${enemy.id}`, (dataUrl) => {
      enemy.imageData = dataUrl;
    });
    y += h;

    this.addField(x, y, 'Health', enemy.health, (d) => { enemy.health = Math.max(1, enemy.health + d); }, 5);
    y += h;
    this.addField(x, y, 'Speed', enemy.speed, (d) => { enemy.speed = Math.max(5, enemy.speed + d); }, 5);
    y += h;
    this.addField(x, y, 'Armor', enemy.armor, (d) => { enemy.armor = Math.max(0, enemy.armor + d); });
    y += h;
    this.addField(x, y, 'Magic Resist', enemy.magicResist, (d) => { enemy.magicResist = Math.max(0, enemy.magicResist + d); });
    y += h;
    this.addField(x, y, 'Reward', enemy.reward, (d) => { enemy.reward = Math.max(1, enemy.reward + d); });
    y += h;
    this.addField(x, y, 'Size', Math.round(enemy.size * 10) / 10, (d) => { enemy.size = Math.max(0.3, Math.round((enemy.size + d * 0.1) * 10) / 10); }, 1);
    y += h;

    // Boss toggle
    const bossText = this.add.text(x, y, `Boss: ${enemy.isBoss ? 'YES' : 'NO'}`, {
      fontSize: '13px', fontFamily: UI.fontFamily,
      color: enemy.isBoss ? '#ff8844' : '#888888',
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    bossText.on('pointerup', () => { enemy.isBoss = !enemy.isBoss; this.refreshUI(); });
    this.editContainer.add(bossText);
    y += h;

    // Flying toggle
    const flyText = this.add.text(x, y, `Flying: ${enemy.isFlying ? 'YES' : 'NO'}`, {
      fontSize: '13px', fontFamily: UI.fontFamily,
      color: enemy.isFlying ? '#44aaff' : '#888888',
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    flyText.on('pointerup', () => { enemy.isFlying = !enemy.isFlying; this.refreshUI(); });
    this.editContainer.add(flyText);
    y += h;

    return y;
  }

  private drawHeroEditor(hero: HeroData, x: number, y: number, h: number): number {
    y = this.addNameField(x, y, hero.name, (n) => { hero.name = n; });
    y += h;
    y = this.addColorPicker(x, y, hero.tint, (c) => { hero.tint = c; });
    y += h + 10;

    // Image upload
    y = this.addImageUpload(x, y, hero.imageData, `hero_${hero.id}`, (dataUrl) => {
      hero.imageData = dataUrl;
    });
    y += h;

    this.addField(x, y, 'Health', hero.health, (d) => { hero.health = Math.max(10, hero.health + d); }, 10);
    y += h;
    this.addField(x, y, 'Damage', hero.damage, (d) => { hero.damage = Math.max(1, hero.damage + d); });
    y += h;
    this.addField(x, y, 'Attack Speed', Math.round(hero.attackSpeed * 10) / 10, (d) => {
      hero.attackSpeed = Math.max(0.1, Math.round((hero.attackSpeed + d * 0.1) * 10) / 10);
    }, 1);
    y += h;
    this.addField(x, y, 'Move Speed', hero.moveSpeed, (d) => { hero.moveSpeed = Math.max(10, hero.moveSpeed + d); }, 10);
    y += h;
    this.addField(x, y, 'Range', hero.range, (d) => { hero.range = Math.max(10, hero.range + d); }, 10);
    y += h;
    this.addField(x, y, 'Armor', hero.armor, (d) => { hero.armor = Math.max(0, hero.armor + d); });
    y += h;

    // Abilities summary
    const abilHeader = this.add.text(x, y, 'Abilities:', {
      fontSize: '14px', fontFamily: UI.fontFamily, color: '#ffcc00', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.editContainer.add(abilHeader);
    y += h;

    hero.abilities.forEach((ability, ai) => {
      const abilText = this.add.text(x + 10, y, `${ability.name} (${ability.effect}) — cd:${ability.cooldown}s dmg:${ability.damage ?? 0}`, {
        fontSize: '12px', fontFamily: UI.fontFamily, color: '#cccccc',
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
      abilText.on('pointerup', () => {
        const dmg = prompt(`${ability.name} damage:`, String(ability.damage ?? 0));
        if (dmg !== null) ability.damage = parseInt(dmg) || 0;
        const cd = prompt(`${ability.name} cooldown (seconds):`, String(ability.cooldown));
        if (cd !== null) ability.cooldown = parseInt(cd) || 5;
        this.refreshUI();
      });
      this.editContainer.add(abilText);
      y += h * 0.8;
    });

    return y;
  }

  private drawWaveEditor(wave: WaveData, x: number, y: number, h: number): number {
    const header = this.add.text(x, y, `Wave ${wave.id}`, {
      fontSize: '16px', fontFamily: UI.fontFamily, color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.editContainer.add(header);
    y += h;

    this.addField(x, y, 'Delay Before (ms)', wave.delayBefore, (d) => { wave.delayBefore = Math.max(0, wave.delayBefore + d); }, 500);
    y += h;
    this.addField(x, y, 'Reward', wave.reward, (d) => { wave.reward = Math.max(0, wave.reward + d); }, 5);
    y += h;

    const groupHeader = this.add.text(x, y, 'Enemy Groups:', {
      fontSize: '14px', fontFamily: UI.fontFamily, color: '#ffcc00', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.editContainer.add(groupHeader);
    y += h;

    wave.enemies.forEach((group, gi) => {
      this.addField(x + 10, y, `${group.enemyId} count`, group.count, (d) => { group.count = Math.max(1, group.count + d); });
      y += h * 0.8;
      this.addField(x + 10, y, `  delay (ms)`, group.delay, (d) => { group.delay = Math.max(100, group.delay + d); }, 100);
      y += h * 0.8;

      // Change enemy type
      const typeText = this.add.text(x + 10, y, `  type: ${group.enemyId} [Change]`, {
        fontSize: '12px', fontFamily: UI.fontFamily, color: '#4488ff',
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
      typeText.on('pointerup', () => {
        const enemyIds = this.enemies.map(e => e.id).join(', ');
        const newId = prompt(`Enemy type (${enemyIds}):`, group.enemyId);
        if (newId && this.enemies.some(e => e.id === newId)) {
          group.enemyId = newId;
          this.refreshUI();
        }
      });
      this.editContainer.add(typeText);
      y += h;
    });

    // Add group button
    const addGroupBtn = new Button(this, x + 80, y, '+ Add Group', () => {
      wave.enemies.push({ enemyId: 'goblin', count: 5, delay: 800, pathId: 'main' });
      this.refreshUI();
    }, 140, 28, 0x338833);
    this.editContainer.add(addGroupBtn);
    y += h;

    return y;
  }

  // ── Data Operations ──

  private getItems(): unknown[] {
    switch (this.activeTab) {
      case 'towers': return this.towers;
      case 'enemies': return this.enemies;
      case 'heroes': return this.heroes;
      case 'waves': return this.waves;
    }
  }

  private getItemName(item: unknown): string {
    if (this.activeTab === 'waves') return `Wave ${(item as WaveData).id}`;
    return (item as { name: string }).name ?? 'Unknown';
  }

  private getItemColor(item: unknown): number {
    if (this.activeTab === 'waves') return 0x888888;
    return (item as { tint: number }).tint ?? 0xaaaaaa;
  }

  private addNewItem() {
    switch (this.activeTab) {
      case 'towers':
        this.towers.push({
          id: 'tower_' + Date.now(),
          name: 'New Tower',
          description: 'A new tower',
          category: 'custom',
          tint: 0xaaaaaa,
          levels: [{ damage: 5, range: 100, fireRate: 1, cost: 50, projectileSpeed: 300 }],
          maxLevel: 1,
        });
        break;
      case 'enemies':
        this.enemies.push({
          id: 'enemy_' + Date.now(),
          name: 'New Enemy',
          health: 50,
          speed: 60,
          armor: 0,
          magicResist: 0,
          reward: 10,
          tint: 0xaaaaaa,
          size: 1,
        });
        break;
      case 'heroes':
        this.heroes.push({
          id: 'hero_' + Date.now(),
          name: 'New Hero',
          description: 'A new hero',
          health: 200,
          damage: 10,
          attackSpeed: 1,
          moveSpeed: 100,
          range: 60,
          armor: 2,
          abilities: [],
          tint: 0xaaaaaa,
          size: 1,
        });
        break;
      case 'waves': {
        const nextId = this.waves.length > 0 ? Math.max(...this.waves.map(w => w.id)) + 1 : 1;
        this.waves.push({
          id: nextId,
          enemies: [{ enemyId: 'goblin', count: 5, delay: 800, pathId: 'main' }],
          reward: 25,
          delayBefore: 5000,
        });
        break;
      }
    }
    this.selectedIndex = this.getItems().length - 1;
    this.refreshUI();
  }

  private deleteItem(index: number) {
    switch (this.activeTab) {
      case 'towers': this.towers.splice(index, 1); break;
      case 'enemies': this.enemies.splice(index, 1); break;
      case 'heroes': this.heroes.splice(index, 1); break;
      case 'waves': this.waves.splice(index, 1); break;
    }
    this.selectedIndex = Math.max(0, index - 1);
    this.refreshUI();
  }

  private saveData() {
    DataManager.saveTowers(this.towers);
    DataManager.saveEnemies(this.enemies);
    DataManager.saveHeroes(this.heroes);
    DataManager.saveWaves(this.waves);
    alert('All data saved!');
  }

  private clearContainer(container: Phaser.GameObjects.Container) {
    container.each((child: Phaser.GameObjects.GameObject) => child.destroy());
    container.removeAll();
  }
}
