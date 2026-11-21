// DEMO title scene (replace me). Shows: Menu/Button (tap, mouse, keyboard), menuLayout, tweens,
// screen-space particles, highscore display.

import { Button, Menu, text } from '../engine/ui.js';
import { rand } from '../engine/util.js';

export function titleScene(game) {
  const { view, input, audio, fx, scenes } = game;
  const deco = { bob: 0 };
  let t = 0;
  const menu = new Menu([
    new Button({ label: 'Play', color: '#4f7cff', onClick: () => { audio.play('ui_confirm'); scenes.go('play'); } }),
  ]);

  return {
    enter() {
      fx.tween(deco, { bob: 1 }, 1.4, { ease: 'sineInOut', yoyo: true, repeat: -1 });
      audio.music('music', { fade: 1.5 });
    },
    update(dt) {
      t += dt;
      menu.layout(view);
      menu.update(input, dt);
      if (Math.random() < dt * 8) { // ambient rising motes
        fx.burst('dust', rand(0, view.w), view.h + 20, {
          count: 1, angle: -Math.PI / 2, spread: 0.6, speed: [30, 90], gravity: -25, drag: 0.2,
          life: [3, 5], size: [6, 16], alpha: 0.35, color: ['#4f7cff', '#ffd166', '#ff5d73'],
        });
      }
    },
    render(ctx) {
      const L = menu.layout(view);
      const g = ctx.createLinearGradient(0, 0, 0, view.h);
      g.addColorStop(0, '#1b1b2e'); g.addColorStop(1, '#0f0f17');
      ctx.fillStyle = g; ctx.fillRect(0, 0, view.w, view.h);
      fx.drawWorld(ctx);
      text(ctx, game.config.title, L.title.x, L.title.y - deco.bob * 14, {
        size: L.title.size, color: '#ffd166', outline: 8, outlineColor: '#2a1a40', shadow: 10,
      });
      text(ctx, 'theme-neutral starter kit', L.subtitle.x, L.subtitle.y, { size: L.subtitle.size, color: '#c9c9de' });
      menu.draw(ctx);
      const best = game.best.get();
      const b0 = L.buttons[L.buttons.length - 1];
      if (best > 0) text(ctx, `BEST ${best}`, view.w / 2, b0.y + b0.h / 2 + 50, { size: 30, color: '#ffd166', outline: 4 });
      const hint = view.isTouch
        ? 'Left thumb: move   ·   DASH button: dash'
        : 'Move: WASD / Arrows   ·   Dash: Space / Click   ·   Pause: Esc / P';
      text(ctx, hint, view.w / 2, L.footerY, { size: 22, color: 'rgba(255,255,255,0.55)', maxWidth: view.w - 40 });
    },
  };
}
