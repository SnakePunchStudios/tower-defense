import Phaser from 'phaser';
import { COLORS, UI } from '../constants';

export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private callback: () => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    callback: () => void,
    width: number = UI.buttonWidth,
    height: number = UI.buttonHeight,
    color: number = COLORS.buttonNormal,
  ) {
    super(scene, x, y);
    this.callback = callback;

    this.bg = scene.add.rectangle(0, 0, width, height, color);
    this.bg.setStrokeStyle(2, 0x888888);
    this.add(this.bg);

    this.label = scene.add.text(0, 0, text, {
      fontSize: `${Math.min(16, height - 12)}px`,
      fontFamily: UI.fontFamily,
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5);
    this.add(this.label);

    this.setSize(width, height);
    this.setInteractive({ useHandCursor: true });

    this.on('pointerover', () => this.bg.setFillStyle(COLORS.buttonHover));
    this.on('pointerout', () => this.bg.setFillStyle(color));
    this.on('pointerdown', () => {
      this.bg.setFillStyle(0x2a2a4c);
      this.setScale(0.95);
    });
    this.on('pointerup', () => {
      this.bg.setFillStyle(color);
      this.setScale(1);
      this.callback();
    });

    scene.add.existing(this);
  }

  setText(text: string) {
    this.label.setText(text);
  }

  setEnabled(enabled: boolean) {
    if (enabled) {
      this.setInteractive();
      this.setAlpha(1);
    } else {
      this.disableInteractive();
      this.setAlpha(0.5);
    }
  }
}
