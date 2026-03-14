import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './constants';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { GameScene } from './scenes/GameScene';
import { MapEditorScene } from './scenes/MapEditorScene';
import { DataEditorScene } from './scenes/DataEditorScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  backgroundColor: '#2d5a27',
  input: {
    touch: true,
  },
  scene: [BootScene, MainMenuScene, GameScene, MapEditorScene, DataEditorScene],
};

const game = new Phaser.Game(config);

// Expose for debugging / preview testing
(window as unknown as Record<string, unknown>).__PHASER_GAME__ = game;
