import Phaser from 'phaser';
import type { Hero } from '../entities/Hero';
import { COLORS, UI } from '../constants';

export class HeroPanel extends Phaser.GameObjects.Container {
  private heroes: Hero[] = [];
  private portraits: Phaser.GameObjects.Container[] = [];
  private abilityButtons: Phaser.GameObjects.Container[][] = [];

  public onHeroSelected?: (hero: Hero) => void;
  public onAbilityUsed?: (hero: Hero, abilityIndex: number) => void;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.setDepth(15);
    scene.add.existing(this);
  }

  setup(heroes: Hero[]) {
    this.heroes = heroes;
    this.portraits = [];
    this.abilityButtons = [];

    heroes.forEach((hero, i) => {
      const px = 80 + i * 200;
      const py = 600;

      // Portrait background
      const portrait = this.scene.add.container(px, py);

      const bg = this.scene.add.rectangle(0, 0, 48, 48, COLORS.hud, 0.9);
      bg.setStrokeStyle(2, 0x666666);
      portrait.add(bg);

      // Hero icon
      const icon = this.scene.add.polygon(
        0, 0,
        [0, -10, 10, 0, 0, 10, -10, 0],
        hero.heroData.tint,
      );
      portrait.add(icon);

      // Name below
      const name = this.scene.add.text(0, 30, hero.heroData.name, {
        fontSize: '11px',
        fontFamily: UI.fontFamily,
        color: '#ffffff',
      }).setOrigin(0.5);
      portrait.add(name);

      portrait.setSize(48, 48);
      portrait.setInteractive({ useHandCursor: true });
      portrait.on('pointerup', () => this.onHeroSelected?.(hero));
      this.add(portrait);
      this.portraits.push(portrait);

      // Ability buttons
      const abilBtns: Phaser.GameObjects.Container[] = [];
      hero.heroData.abilities.forEach((ability, ai) => {
        const ax = px + 40 + ai * 44;
        const ay = py;

        const abilBtn = this.scene.add.container(ax, ay);
        const abilBg = this.scene.add.rectangle(0, 0, 38, 38, ability.tint, 0.8);
        abilBg.setStrokeStyle(1, 0xaaaaaa);
        abilBtn.add(abilBg);

        const letter = this.scene.add.text(0, 0, ability.name[0], {
          fontSize: '16px',
          fontFamily: UI.fontFamily,
          fontStyle: 'bold',
          color: '#ffffff',
        }).setOrigin(0.5);
        abilBtn.add(letter);

        // Cooldown overlay
        const cdOverlay = this.scene.add.rectangle(0, 0, 36, 36, 0x000000, 0);
        abilBtn.add(cdOverlay);

        const cdText = this.scene.add.text(0, 0, '', {
          fontSize: '12px',
          fontFamily: UI.fontFamily,
          color: '#ffffff',
        }).setOrigin(0.5);
        abilBtn.add(cdText);

        abilBtn.setSize(38, 38);
        abilBtn.setInteractive({ useHandCursor: true });
        abilBtn.on('pointerup', () => this.onAbilityUsed?.(hero, ai));

        // Store references for updating
        abilBtn.setData('cdOverlay', cdOverlay);
        abilBtn.setData('cdText', cdText);
        abilBtn.setData('abilityId', ability.id);

        this.add(abilBtn);
        abilBtns.push(abilBtn);
      });
      this.abilityButtons.push(abilBtns);
    });
  }

  tick() {
    this.heroes.forEach((hero, i) => {
      // Update portrait border for selection
      const bg = this.portraits[i].list[0] as Phaser.GameObjects.Rectangle;
      bg.setStrokeStyle(2, hero.isSelected ? 0xffff00 : 0x666666);

      // Grey out if dead
      this.portraits[i].setAlpha(hero.isDead ? 0.4 : 1);

      // Update ability cooldowns
      this.abilityButtons[i]?.forEach(btn => {
        const abilityId = btn.getData('abilityId') as string;
        const cdOverlay = btn.getData('cdOverlay') as Phaser.GameObjects.Rectangle;
        const cdText = btn.getData('cdText') as Phaser.GameObjects.Text;

        const cd = hero.abilityCooldowns.get(abilityId) ?? 0;
        if (cd > 0) {
          cdOverlay.setFillStyle(0x000000, 0.5);
          cdText.setText(Math.ceil(cd / 1000).toString());
        } else {
          cdOverlay.setFillStyle(0x000000, 0);
          cdText.setText('');
        }
      });
    });
  }
}
