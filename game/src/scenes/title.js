// CORVID title: dark factory silhouette in the rain, a glowing window, a crow crossing the sky, canvas-drawn logo.
// Start -> intro cutscene -> play. Continue (if a save exists) -> play from the saved room.
import { Button, Menu, text } from '../engine/ui.js';
import { sprites } from '../game/sprites.js';
import { playMenu } from '../game/soundtrack.js';
import { W, H, framePanel, sky, skyline, tower, glint, rain, crow, drawLogo, vignette } from './storyart.js';

export function titleScene(game) {
  const { view, input, audio, scenes, storage } = game;
  let t = 0, flash = 0, nextFlash = 5, started = false;
  const save = storage.get('save', null);
  const hasSave = !!(save && save.snap);
  const go = (name, params) => { if (started) return; started = true; audio.play('ui_confirm'); scenes.go(name, params, { fade: 0.6 }); };
  const buttons = [new Button({ label: 'START', color: '#b8122e', onClick: () => { storage.remove('save'); go('intro'); } })];
  if (hasSave) buttons.push(new Button({ label: 'CONTINUE', color: '#2a3140', onClick: () => go('play', { cont: save }) }));
  const menu = new Menu(buttons);

  function backdrop(ctx) {
    const img = sprites.get('cutscene_rooftop');
    ctx.save();
    if (img) {
      const s = Math.max(view.w / img.width, view.h / img.height);
      ctx.drawImage(img, (view.w - img.width * s) / 2, (view.h - img.height * s) / 2, img.width * s, img.height * s);
      ctx.restore(); return;
    }
    const sc = framePanel(ctx, view, 1000 + Math.sin(t * 0.15) * 40, 520, 1);
    if (view.h > view.w) ctx.translate(0, view.h * 0.1 / sc); // portrait: drop the tower so its window sits below the logo
    sky(ctx, '#05060b', '#111522', '#241624');
    skyline(ctx, 800, 11, { color: '#0b0e16', lit: 0.1, minH: 100, maxH: 330 });
    skyline(ctx, 880, 12, { color: '#07090e', lit: 0.16, minH: 80, maxH: 220, win: 'rgba(255,160,70,0.6)' });
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.4);
    const win = tower(ctx, 1020, 900, t, { pulse });
    glint(ctx, win.x, win.y, 70 + pulse * 30, 0.55 + 0.4 * Math.sin(t * 2.3), t);
    // crow crossing the sky every ~11 s
    const k = (t % 11) / 11;
    if (k < 0.5) {
      const p = k / 0.5, cx = -100 + p * (W + 200), cy = 260 + Math.sin(p * 6) * 24 - p * 60;
      crow(ctx, cx, cy, 1.15, { flap: Math.sin(t * 14), lean: -0.05 });
    }
    ctx.restore();
  }

  return {
    enter() { try { playMenu(); } catch (e) { /* audio optional */ } },
    update(dt) {
      t += dt; nextFlash -= dt;
      if (nextFlash < 0) { flash = 1; nextFlash = 4 + Math.random() * 6; }
      flash = Math.max(0, flash - dt * 3);
      menu.layout(view, { bh: 96, gap: 20 });
      const c = menu.update(input, dt);
      const tap = input.tap;
      if (!c && tap && !started && !buttons.some((b) => b.contains(tap.x, tap.y, 10))) buttons[0].activate();
    },
    render(ctx) {
      const L = menu.layout(view, { bh: 96, gap: 20 });
      ctx.fillStyle = '#05060b'; ctx.fillRect(0, 0, view.w, view.h);
      backdrop(ctx);
      rain(ctx, view, t, 1);
      if (flash > 0) { ctx.fillStyle = `rgba(190,210,255,${flash * 0.12})`; ctx.fillRect(0, 0, view.w, view.h); }
      vignette(ctx, view, 0.65);
      const lw = Math.min(view.w * 0.9, view.h * 0.9, 760);
      const logo = sprites.get('title_logo');
      if (logo) { const h = lw * logo.height / logo.width; ctx.drawImage(logo, view.w / 2 - lw / 2, L.title.y - h / 2, lw, h); }
      else drawLogo(ctx, view.w / 2, L.title.y, lw * 0.82, t);
      text(ctx, 'a symbiosis heist', view.w / 2, L.title.y + lw * 0.2, { size: Math.max(24, lw * 0.05), color: '#e9c9cf', outline: 4, weight: 500, family: 'Georgia, serif' });
      menu.draw(ctx);
      const hint = view.isTouch ? 'tap START' : 'Enter / click to start';
      text(ctx, hint, view.w / 2, L.footerY, { size: 20, color: 'rgba(255,255,255,0.45)', outline: 3 });
    },
  };
}
