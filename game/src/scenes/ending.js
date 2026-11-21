// CORVID ending: the crow lifts the Shiny out of the tower window, the factory lights pulse (174 BPM), flight over the city at dawn,
// credits card with time taken and a restart button. params: {time, deaths}. Debug: ?t=<seconds> jumps the timeline.
import { Button, Menu, text } from '../engine/ui.js';
import { playMenu } from '../game/soundtrack.js';
import { sprites } from '../game/sprites.js';
import { W, H, framePanel, sky, skyline, tower, glint, rain, crow, drawLogo, caption, vignette, seg, smooth, lerp, fmtTime } from './storyart.js';

const mix = (a, b, k) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], k))).join(',')})`;

export function endingScene(game) {
  const { view, input, audio, scenes, storage } = game;
  let t = 0, time = 0, deaths = 0, started = false;
  const go = (name, params) => { if (started) return; started = true; audio.play('ui_confirm'); scenes.go(name, params, { fade: 0.7 }); };
  const menu = new Menu([
    new Button({ label: 'RESTART', color: '#b8122e', onClick: () => { storage.remove('save'); go('title'); } }),
  ]);

  // ref-space path of the crow: window (1020,260) -> out over the city -> far toward the sunrise
  function crowPos(tt) {
    if (tt < 4.5) { const p = smooth(seg(tt, 1.5, 4.5)); return { x: 1000 - 90 * (1 - p) + p * 20, y: 520 - p * 60 - Math.sin(p * Math.PI) * 30, s: 1.6, sh: true }; }
    const p = seg(tt, 4.5, 15);
    return { x: lerp(1060, 1500, smooth(p)), y: lerp(430, 360, p) + Math.sin(tt * 1.8) * 14, s: lerp(1.4, 0.55, smooth(p)), sh: true };
  }

  function render(ctx) {
    const beat = t * 174 / 60, pulse = 1 - (beat % 1);
    const night = 1 - smooth(seg(t, 5, 11)); // 1 = night, 0 = dawn
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, view.w, view.h);
    ctx.save();
    const cp = crowPos(t);
    if (t < 4.5) {
      // INTERIOR: dark hall, window arch, wall lights pulsing on the beat; crow lifts the Shiny
      framePanel(ctx, view, 800, 520, 1);
      sky(ctx, '#05070b', '#0a0d14', '#12161e');
      ctx.fillStyle = '#0d1118';
      for (let i = 0; i < 9; i++) ctx.fillRect(i * 200 - 60, 0, 36, 1000);
      for (let i = 0; i < 9; i++) {
        const on = (Math.floor(beat) + i) % 3 === 0 ? pulse : 0.12;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = i % 2 ? `rgba(255,47,77,${0.2 + 0.7 * on})` : `rgba(79,243,255,${0.2 + 0.7 * on})`;
        ctx.shadowColor = i % 2 ? '#ff2f4d' : '#4ff3ff'; ctx.shadowBlur = 24 * on; ctx.fillRect(i * 200 - 54, 120, 24, 760); ctx.restore();
      }
      // window arch with the city beyond
      ctx.save(); ctx.beginPath(); ctx.moveTo(520, 900); ctx.lineTo(520, 380); ctx.quadraticCurveTo(800, 80, 1080, 380); ctx.lineTo(1080, 900); ctx.closePath(); ctx.clip();
      sky(ctx, '#0a0c16', '#1b1626', '#3a2230', 100, 900); skyline(ctx, 880, 12, { color: '#07090e', lit: 0.2, minH: 80, maxH: 220 });
      ctx.restore();
      ctx.strokeStyle = '#1c222c'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(520, 900); ctx.lineTo(520, 380); ctx.quadraticCurveTo(800, 80, 1080, 380); ctx.lineTo(1080, 900); ctx.stroke();
      ctx.fillStyle = '#0a0d12'; ctx.fillRect(480, 880, 640, 40);
      // shiny rises with the crow
      const p = smooth(seg(t, 1.2, 4.2)), sx = 800 + p * 20, sy = 860 - p * 380;
      glint(ctx, sx, sy + 40, 90 + pulse * 40, 0.9, t);
      crow(ctx, sx, sy - 6, 2.3, { flap: p > 0.05 ? Math.sin(t * 16) : 0, perch: p < 0.05, flip: false, lean: -0.1 });
      ctx.fillStyle = `rgba(255,255,255,${0.12 * pulse})`; ctx.fillRect(0, 0, W, H);
    } else {
      // EXTERIOR: night -> dawn, tower behind with pulsing lights, crow carrying the glint over the city
      const pan = seg(t, 4.5, 15);
      framePanel(ctx, view, lerp(900, 1150, smooth(pan)), lerp(520, 470, smooth(pan)), lerp(1.3, 1.0, smooth(pan)));
      const top = mix([5, 6, 11], [58, 74, 120], 1 - night), mid = mix([16, 19, 31], [190, 110, 110], 1 - night), bot = mix([42, 24, 38], [255, 176, 96], 1 - night);
      sky(ctx, top, mid, bot);
      // sun
      const sunY = lerp(1000, 760, 1 - night);
      const sg = ctx.createRadialGradient(1300, sunY, 10, 1300, sunY, 520);
      sg.addColorStop(0, `rgba(255,220,150,${0.9 * (1 - night)})`); sg.addColorStop(1, 'rgba(255,160,90,0)');
      ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
      skyline(ctx, 800, 11, { color: mix([11, 14, 22], [40, 36, 58], 1 - night), lit: 0.1 * night + 0.02, minH: 100, maxH: 330 });
      skyline(ctx, 880, 12, { color: mix([7, 9, 14], [24, 22, 36], 1 - night), lit: 0.16 * night + 0.02, minH: 80, maxH: 220 });
      // tower: lights pulse on the beat for a few seconds, then settle
      const throb = 1 - seg(t, 8, 12);
      const win = tower(ctx, 520, 900, t, { pulse: pulse * throb, dim: night });
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const on = ((Math.floor(beat) + i) % 3 === 0 ? pulse : 0.1) * throb;
        ctx.fillStyle = `rgba(255,47,77,${0.6 * on})`; ctx.shadowColor = '#ff2f4d'; ctx.shadowBlur = 20 * on; ctx.fillRect(400 + i * 48, 560 + (i % 2) * 90, 22, 8);
      }
      ctx.restore();
      glint(ctx, cp.x, cp.y + 26 * cp.s, 40 * cp.s + pulse * 10, 0.9, t);
      crow(ctx, cp.x, cp.y, cp.s, { flap: Math.sin(t * 15), lean: -0.12, flip: false });
    }
    ctx.restore();
    if (night > 0.2) rain(ctx, view, t, 0.5 * night);
    vignette(ctx, view, 0.55);
    // intro fade
    if (t < 0.5) { ctx.fillStyle = `rgba(0,0,0,${1 - t / 0.5})`; ctx.fillRect(0, 0, view.w, view.h); }
    if (t > 4.2 && t < 4.7) { ctx.fillStyle = `rgba(255,244,176,${1 - Math.abs(t - 4.45) / 0.25})`; ctx.fillRect(0, 0, view.w, view.h); }

    // captions + credits card
    if (t > 2.2 && t < 4.4) caption(ctx, view, 'The suit stayed behind. It did not mind. It is a suit.', Math.min(seg(t, 2.2, 3), 1 - seg(t, 4.0, 4.4)));
    const card = smooth(seg(t, 10.5, 12));
    if (card > 0) {
      ctx.fillStyle = `rgba(4,5,10,${0.55 * card})`; ctx.fillRect(0, 0, view.w, view.h);
      const L = menu.layout(view, { bh: 92 });
      const lw = Math.min(view.w * 0.85, 640, view.h * 0.8);
      ctx.save(); ctx.globalAlpha = card;
      const logo = sprites.get('title_logo');
      const ly = view.h * (view.h > view.w ? 0.26 : 0.24);
      if (logo) { const h = lw * logo.height / logo.width; ctx.drawImage(logo, view.w / 2 - lw / 2, ly - h / 2, lw, h); } else drawLogo(ctx, view.w / 2, ly, lw * 0.8, t);
      ctx.restore();
      text(ctx, 'thanks for playing', view.w / 2, ly + lw * 0.2, { size: Math.max(28, lw * 0.06), color: '#f1e9dc', outline: 4, alpha: card, family: 'Georgia, serif', weight: 500 });
      const a2 = smooth(seg(t, 11.8, 13));
      text(ctx, `Time taken  ${fmtTime(time)}`, view.w / 2, ly + lw * 0.2 + 70, { size: 34, color: '#ffd9a0', outline: 4, alpha: a2 });
      text(ctx, deaths ? `Crow lost to lasers and pistons: ${deaths}` : 'Not a single feather lost.', view.w / 2, ly + lw * 0.2 + 116, { size: 24, color: '#cfd6e6', outline: 4, alpha: a2 * 0.9 });
      ctx.save(); ctx.globalAlpha = smooth(seg(t, 12.6, 13.6)); menu.draw(ctx); ctx.restore();
    }
  }

  return {
    enter(p = {}) {
      time = p.time ?? (game.state.world && game.state.world.time) ?? 0; deaths = p.deaths ?? (game.state.world && game.state.world.deaths) ?? 0;
      const o = game.params && game.params.get && +game.params.get('t');
      if (o) t = o;
      try { playMenu(); } catch (e) { /* optional */ }
    },
    update(dt) {
      t += dt;
      menu.layout(view, { bh: 92 });
      if (t > 12.6) { const c = menu.update(input, dt); if (c) return; }
    },
    render,
  };
}
