// Narration: plays audio id on the sfx bus (music ducked), queues instead of overlapping,
// never repeats an id unless forced, and exposes the current line as a subtitle.
import { LINES } from './lines.js';
import { wrapText, roundRect } from '../engine/ui.js';

export function createVoice(game) {
  const { audio } = game;
  const queue = [];
  const spoken = new Set();
  const loading = new Set();
  let cur = null;          // { id, left, total }
  let gap = 0;             // short pause between lines
  let alpha = 0;

  const voice = {
    subtitle: '',
    lines: LINES,

    /** Load any narration file not already registered (assets/voice/<id>.mp3). Never rejects. */
    preload() {
      const map = {};
      for (const id of Object.keys(LINES)) {
        if (audio.buffers && audio.buffers.has(id)) continue;
        if (loading.has(id)) continue;
        loading.add(id);
        map[id] = 'assets/voice/' + id + '.mp3';
      }
      if (!Object.keys(map).length) return Promise.resolve();
      try { return Promise.resolve(audio.load(map)).catch(() => {}); } catch (e) { return Promise.resolve(); }
    },

    say(id, { force = false } = {}) {
      if (!LINES[id]) return false;
      if (!force && spoken.has(id)) return false;
      if (cur && cur.id === id) return false;
      if (queue.includes(id)) return false;
      spoken.add(id);
      queue.push(id);
      return true;
    },

    /** Drop everything queued / playing (e.g. on skipping a cutscene). */
    clear() { queue.length = 0; cur = null; voice.subtitle = ''; },

    isSpeaking() { return !!cur || queue.length > 0; },

    update(dt) {
      if (cur) {
        cur.left -= dt;
        if (cur.left <= 0) { cur = null; gap = 0.25; }
      } else if (gap > 0) gap -= dt;
      if (!cur && gap <= 0 && queue.length) start(queue.shift());
      const want = cur ? 1 : 0;
      alpha += (want - alpha) * Math.min(1, dt * 10);
      if (!cur && alpha < 0.02) { alpha = 0; voice.subtitle = ''; }
    },

    drawSubtitles(ctx, view) {
      if (!voice.subtitle || alpha <= 0.02) return;
      const portrait = view.isPortrait;
      const size = portrait ? 30 : 28;
      const sideTouch = view.isTouch && !portrait ? 360 : 0; // keep clear of the joystick / buttons
      const maxW = Math.min(view.w - 2 * (24 + sideTouch) - view.safe.left - view.safe.right, 880);
      const lines = wrapText(ctx, voice.subtitle, maxW, size, 600);
      const lh = size * 1.28, padX = 22, padY = 14;
      let tw = 0;
      ctx.save();
      ctx.font = '600 ' + size + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      for (const l of lines) tw = Math.max(tw, ctx.measureText(l).width);
      const bw = tw + padX * 2, bh = lines.length * lh + padY * 2;
      // Portrait touch: the bottom belongs to the joystick/buttons, so subtitles sit in the free band above the room.
      const bottom = view.h - view.safe.bottom - (view.isTouch ? 40 : 56);
      const x = view.w / 2 - bw / 2, y = (view.isTouch && portrait) ? view.safe.top + view.h * 0.2 : bottom - bh;
      ctx.globalAlpha *= alpha;
      roundRect(ctx, x, y, bw, bh, 14);
      ctx.fillStyle = 'rgba(8,10,12,0.78)'; ctx.fill();
      ctx.fillStyle = '#f4efe4';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      lines.forEach((l, i) => ctx.fillText(l, view.w / 2, y + padY + lh * (i + 0.5)));
      ctx.restore();
    },
  };

  function start(id) {
    const total0 = audio.buffers && audio.buffers.get(id) ? audio.buffers.get(id).duration : 3.5;
    const total = Math.max(1.5, total0) + 0.3;
    cur = { id, left: total, total };
    voice.subtitle = LINES[id];
    try {
      if (audio.buffers && audio.buffers.has(id)) {
        audio.duck(0.6, total * 1000 * 1.5);
        audio.play(id, { volume: 1, cooldown: 0, maxVoices: 2 });
      }
    } catch (e) { /* audio is optional */ }
  }

  return voice;
}
