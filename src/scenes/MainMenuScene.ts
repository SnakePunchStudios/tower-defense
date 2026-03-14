import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI } from '../constants';
import { Button } from '../ui/Button';
import { DataManager } from '../utils/DataManager';
import { registerBase64Texture } from '../utils/ImageUpload';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x1a1a2e);

    // Title
    this.add.text(GAME_WIDTH / 2, 80, 'TOWER DEFENSE', {
      fontSize: '48px',
      fontFamily: UI.fontFamily,
      fontStyle: 'bold',
      color: '#ffd700',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 125, 'Kingdom Rush Style', {
      fontSize: '18px',
      fontFamily: UI.fontFamily,
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // Decorative towers
    this.add.rectangle(200, 350, 50, 60, 0x4caf50).setStrokeStyle(2, 0x2e7d32);
    this.add.rectangle(760, 350, 50, 60, 0x2196f3).setStrokeStyle(2, 0x1565c0);

    const btnY = 220;
    const spacing = 52;

    // Map selection
    const maps = DataManager.loadMaps();
    let selectedMapIndex = 0;

    const mapLabel = this.add.text(GAME_WIDTH / 2, btnY - 15, `Map: ${maps[selectedMapIndex].name}`, {
      fontSize: '16px',
      fontFamily: UI.fontFamily,
      color: '#ffffff',
    }).setOrigin(0.5);

    if (maps.length > 1) {
      new Button(this, GAME_WIDTH / 2 - 120, btnY - 15, '<', () => {
        selectedMapIndex = (selectedMapIndex - 1 + maps.length) % maps.length;
        mapLabel.setText(`Map: ${maps[selectedMapIndex].name}`);
      }, 36, 30);

      new Button(this, GAME_WIDTH / 2 + 120, btnY - 15, '>', () => {
        selectedMapIndex = (selectedMapIndex + 1) % maps.length;
        mapLabel.setText(`Map: ${maps[selectedMapIndex].name}`);
      }, 36, 30);
    }

    // Play button
    new Button(this, GAME_WIDTH / 2, btnY + spacing * 0.7, 'PLAY', () => {
      this.scene.start('Game', { mapData: maps[selectedMapIndex] });
    }, 200, 52, 0x4caf50);

    // Map Editor
    new Button(this, GAME_WIDTH / 2, btnY + spacing * 1.7, 'Map Editor', () => {
      this.scene.start('MapEditor');
    }, 200, 44);

    // Data Editor
    new Button(this, GAME_WIDTH / 2, btnY + spacing * 2.6, 'Data Editor', () => {
      this.scene.start('DataEditor');
    }, 200, 44);

    // Export / Import row
    new Button(this, GAME_WIDTH / 2 - 70, btnY + spacing * 3.5, 'Export', () => {
      this.exportData();
    }, 120, 40, 0x336688);

    new Button(this, GAME_WIDTH / 2 + 70, btnY + spacing * 3.5, 'Import', () => {
      this.importData();
    }, 120, 40, 0x336688);

    // Reset data
    new Button(this, GAME_WIDTH / 2, btnY + spacing * 4.4, 'Reset All Data', () => {
      if (confirm('Reset all custom data to defaults?')) {
        DataManager.resetAll();
        this.scene.restart();
      }
    }, 200, 36, COLORS.danger);

    // Version
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 20, 'v0.2 — Export & share your creations!', {
      fontSize: '12px',
      fontFamily: UI.fontFamily,
      color: '#666666',
    }).setOrigin(0.5);
  }

  private exportData() {
    const bundle = {
      version: 1,
      towers: DataManager.loadTowers(),
      enemies: DataManager.loadEnemies(),
      heroes: DataManager.loadHeroes(),
      waves: DataManager.loadWaves(),
      maps: DataManager.loadMaps(),
    };

    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tower-defense-data-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  private importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) { input.remove(); return; }

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const bundle = JSON.parse(reader.result as string);

          if (bundle.towers) DataManager.saveTowers(bundle.towers);
          if (bundle.enemies) DataManager.saveEnemies(bundle.enemies);
          if (bundle.heroes) DataManager.saveHeroes(bundle.heroes);
          if (bundle.waves) DataManager.saveWaves(bundle.waves);
          if (bundle.maps) {
            // Merge imported maps with existing, replacing by id
            const existing = DataManager.loadMaps();
            for (const imp of bundle.maps) {
              const idx = existing.findIndex((m: { id: string }) => m.id === imp.id);
              if (idx >= 0) {
                existing[idx] = imp;
              } else {
                existing.push(imp);
              }
            }
            DataManager.saveMaps(existing);
          }

          // Re-register any custom textures from imported data
          const texPromises: Promise<void>[] = [];
          for (const t of (bundle.towers ?? [])) {
            if (t.imageData) texPromises.push(registerBase64Texture(this, `tower_${t.id}`, t.imageData));
          }
          for (const e of (bundle.enemies ?? [])) {
            if (e.imageData) texPromises.push(registerBase64Texture(this, `enemy_${e.id}`, e.imageData));
          }
          for (const h of (bundle.heroes ?? [])) {
            if (h.imageData) texPromises.push(registerBase64Texture(this, `hero_${h.id}`, h.imageData));
          }
          await Promise.all(texPromises);

          alert('Data imported successfully!');
          this.scene.restart();
        } catch (err) {
          alert('Failed to import — invalid file format.');
        }
        input.remove();
      };
      reader.readAsText(file);
    });

    input.addEventListener('cancel', () => input.remove());
    input.click();
  }
}
