// Pause menu (Resume / Restart / Quit), drawn on canvas over the frozen scene.
// Opens via the 'pause' action (Esc / P / gamepad Start), the HTML pause button, or automatically
// when the page loses focus / is hidden. Only scenes with `pausable: true` can be paused.

import { Button, Menu, text } from './ui.js';

export function createPause(game, { menuScene = 'title' } = {}) {
  const { input, view, audio } = game;
  let menu = null;

  const pause = {
    active: false,
    get canPause() {
      const sc = game.scenes, s = sc && sc.current;
      return !!(game.started && s && s.pausable && !sc.transitioning);
    },
    open() {
      if (pause.active || !pause.canPause) return false;
      pause.active = true;
      input.suspendTouch(true);
      menu = new Menu([
        new Button({ label: 'Resume', color: '#4f7cff', onClick: () => pause.close() }),
        new Button({ label: 'Restart', color: '#f08a24', onClick: () => { pause.close(); game.scenes.restart(); } }),
        new Button({ label: 'Quit', color: '#5a5f73', onClick: () => { pause.close(); game.scenes.go(menuScene); } }),
      ]);
      const s = game.scenes.current;
      if (s && s.onPause) { try { s.onPause(); } catch (e) { console.error(e); } }
      audio.play('ui_click');
      return true;
    },
    close() {
      if (!pause.active) return;
      pause.active = false;
      menu = null;
      input.suspendTouch(false);
      const s = game.scenes.current;
      if (s && s.onResume) { try { s.onResume(); } catch (e) { console.error(e); } }
    },
    toggle() { return pause.active ? (pause.close(), false) : pause.open(); },
    update(dt) {
      if (!menu) return;
      const m = menu;
      m.layout(view, { row: false, bw: Math.min(view.w * 0.7, 380) });
      m.update(input, dt);
      if (pause.active && input.pressed('back')) pause.close();
    },
    render(ctx) {
      if (!pause.active || !menu) return;
      ctx.save();
      ctx.fillStyle = 'rgba(6, 6, 12, 0.66)';
      ctx.fillRect(-10, -10, view.w + 20, view.h + 20);
      const L = menu.lastLayout || menu.layout(view, { row: false });
      text(ctx, 'PAUSED', L.title.x, L.title.y, { size: L.title.size * 0.8, outline: 6, color: '#fff' });
      menu.draw(ctx);
      const hint = view.isTouch ? '' : 'Esc / P to resume';
      if (hint) text(ctx, hint, view.w / 2, L.footerY, { size: 24, color: 'rgba(255,255,255,0.6)' });
      ctx.restore();
    },
  };
  return pause;
}
