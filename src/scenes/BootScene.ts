import Phaser from 'phaser';
import { DataManager } from '../utils/DataManager';
import { registerBase64Texture } from '../utils/ImageUpload';
import { syncCommunityMaps } from '../utils/GitHubSync';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const text = this.add.text(480, 300, 'Loading...', {
      fontSize: '24px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Load custom textures + sync community maps in parallel, then start
    Promise.all([
      this.loadCustomTextures(),
      syncCommunityMaps().catch(() => ({ added: 0, total: 0 })), // silently fail if offline
    ]).then(([, syncResult]) => {
      if (syncResult.added > 0) {
        text.setText(`Downloaded ${syncResult.added} new map${syncResult.added > 1 ? 's' : ''}!`);
        // Brief pause so they can read the message
        this.time.delayedCall(1500, () => {
          text.destroy();
          this.scene.start('MainMenu');
        });
      } else {
        text.destroy();
        this.scene.start('MainMenu');
      }
    });
  }

  private async loadCustomTextures(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const tower of DataManager.loadTowers()) {
      if (tower.imageData) {
        promises.push(registerBase64Texture(this, `tower_${tower.id}`, tower.imageData));
      }
    }

    for (const enemy of DataManager.loadEnemies()) {
      if (enemy.imageData) {
        promises.push(registerBase64Texture(this, `enemy_${enemy.id}`, enemy.imageData));
      }
    }

    for (const hero of DataManager.loadHeroes()) {
      if (hero.imageData) {
        promises.push(registerBase64Texture(this, `hero_${hero.id}`, hero.imageData));
      }
    }

    await Promise.all(promises);
  }
}
