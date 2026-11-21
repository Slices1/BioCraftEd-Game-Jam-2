import { Body } from './base.js';
import { move, settle } from '../physics.js';
import { P, box, shadow, glow, facing, C, METAL } from '../iso.js';
import { sprites } from '../sprites.js';

const SUIT = { top: '#4a5260', left: '#232831', right: '#333a46', edge: 'rgba(0,0,0,0.6)' };
export class Suit extends Body {
  constructor(def) {
    super(def, 0.34);
    this.pusher = true; this.stepT = 0; this.walkT = 0; this.carried = !!def.carried;
  }
  walk(dt, mx, my, w) {
    const sp = 2.1;
    this.vx = mx * sp; this.vy = my * sp;
    const moved = move(w, this, this.vx * dt, this.vy * dt);
    this.face = facing(this.vx, this.vy, this.face);
    if (moved && Math.hypot(mx, my) > 0.2) {
      this.walkT += dt; this.stepT -= dt;
      if (this.stepT <= 0) { this.stepT = 0.38; w.sfx('step', { volume: 0.55, pitchVar: 0.12 }); }
    }
  }
  update(dt, w) { if (!this.held) settle(w, this); }
  draw(ctx, t, w) {
    if (this.hidden) return;
    const piloted = w.ctrl.active === this.id;
    const z = this.held ? this.z : this.z;
    shadow(ctx, this.x, this.y, this.held ? w.heightAt(Math.floor(this.x), Math.floor(this.y)) : z, 20);
    const [sx, sy] = P(this.x, this.y, z);
    if (!sprites.draw(ctx, 'suit', this.face, sx, sy + 4, 64)) {
      const bob = piloted ? Math.abs(Math.sin(this.walkT * 9)) * 0.04 : 0;
      const x = this.x - 0.3, y = this.y - 0.3;
      box(ctx, x + 0.02, y + 0.12, z, 0.18, 0.18, 0.55, METAL);          // legs
      box(ctx, x + 0.4, y + 0.12, z, 0.18, 0.18, 0.55, METAL);
      box(ctx, x - 0.02, y - 0.02, z + 0.5 + bob, 0.64, 0.64, 0.75, SUIT); // torso
      box(ctx, x + 0.17, y + 0.17, z + 1.25 + bob, 0.3, 0.3, 0.18, METAL);  // cockpit socket
      glow(ctx, this.x + 0.02, this.y + 0.02, z + 1.45 + bob, piloted ? 3.5 : 2, piloted ? C.cyan : (Math.sin(t * 3) > 0 ? C.amber : '#553a10'));
      const [lx, ly] = P(this.x + 0.34, this.y, z + 0.95 + bob);            // chest light strip
      ctx.save(); ctx.shadowColor = piloted ? C.cyan : C.amber; ctx.shadowBlur = 8;
      ctx.fillStyle = piloted ? C.cyan : '#7a5a1a'; ctx.fillRect(lx - 2, ly - 6, 4, 10); ctx.restore();
    }
    if (this.carried) glow(ctx, this.x, this.y, z + 0.05, 1, 'rgba(79,243,255,0.25)', 14);
  }
}
