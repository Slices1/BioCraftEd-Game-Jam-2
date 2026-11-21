// DEMO game-over scene (replace me). Shows: highscore submit, confetti, Retry/Menu buttons with an
// input grace period so a mashed key doesn't skip the screen.

import { Button, Menu, text } from '../engine/ui.js';

export function gameoverScene(game) {
  const { view, input, audio, fx, scenes } = game;
  let score = 0, result = { best: 0, isNew: false }, t = 0, confettiT = 0;
  const menu = new Menu([
    new Button({ label: 'Retry', color: '#4f7cff', onClick: () => { audio.play('ui_confirm'); scenes.go('play'); } }),
    new Button({ label: 'Menu', color: '#5a5f73', onClick: () => { audio.play('ui_click'); scenes.go('title'); } }),
  ]);

  return {
    enter(params = {}) {
      score = params.score | 0;
      result = game.best.submit(score);
      if (result.isNew && score > 0) {
        audio.play('win');
        fx.burst('confetti', view.w / 2, view.h * 0.4);
      }
    },
    update(dt) {
      t += dt;
      menu.layout(view);
      if (t > 0.5) menu.update(input, dt); // grace period
      if (result.isNew && score > 0 && (confettiT -= dt) <= 0 && t < 3) {
        confettiT = 0.6;
        fx.burst('confetti', view.w * (0.2 + Math.random() * 0.6), view.h * 0.45, { count: 24 });
      }
    },
    render(ctx) {
      const L = menu.layout(view);
      ctx.fillStyle = '#14101c';
      ctx.fillRect(0, 0, view.w, view.h);
      text(ctx, 'GAME OVER', L.title.x, L.title.y, { size: L.title.size * 0.85, color: '#ff5d73', outline: 8, shadow: 8 });
      text(ctx, `SCORE ${score}`, L.subtitle.x, L.subtitle.y + 10, { size: L.subtitle.size * 1.5, outline: 5 });
      const line = result.isNew && score > 0 ? 'NEW BEST!' : `BEST ${result.best}`;
      text(ctx, line, L.subtitle.x, L.subtitle.y + 10 + L.subtitle.size * 1.6, {
        size: L.subtitle.size * 1.1, color: '#ffd166', outline: 4, alpha: result.isNew ? 0.75 + 0.25 * Math.sin(t * 8) : 1,
      });
      menu.draw(ctx);
      fx.drawWorld(ctx);
    },
  };
}
