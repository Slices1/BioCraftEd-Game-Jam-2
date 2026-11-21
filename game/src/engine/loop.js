// Fixed-timestep game loop: update() at a fixed rate (default 60 Hz) via an accumulator,
// render() once per requestAnimationFrame. Frame dt is clamped and the number of catch-up steps
// is capped, so a slow device slows down instead of spiralling. Supports timeScale + hitstop.
// Auto-pause on visibilitychange / blur: if loop.onAutoPause is set, the GAME handles it (main.js
// opens its pause menu, which needs updates to keep running); otherwise the loop pauses itself
// and resumes on visible / focus / any pointer or key input (never stuck paused).
//
//   update(dt)  dt = step * timeScale (already scaled; 0 never happens: timeScale 0 skips updates)
//   render(frameDt)  real seconds since last frame (clamped)

export function createLoop({ update, render, step = 1 / 60, maxFrame = 0.1, maxSteps = 6, autoPause = true } = {}) {
  let acc = 0, last = 0, raf = 0, errorCount = 0;

  const loop = {
    step,
    timeScale: 1,
    paused: false,
    pauseReason: null,
    running: false,
    time: 0,      // game time in seconds (advances with scaled updates)
    realTime: 0,  // real seconds the loop has been rendering
    frame: 0,     // rendered frames
    steps: 0,     // fixed updates executed
    fps: 60,
    alpha: 0,     // leftover fraction of a step (for optional render interpolation)
    hitstopLeft: 0,
    errors: 0,
    lastError: null,
    /** fn(reason: 'hidden' | 'blur'). If set, replaces the loop's own auto-pause. */
    onAutoPause: null,
    /** fn(reason) when the page is visible / focused / interacted with again. */
    onAutoResume: null,

    start() {
      if (loop.running) return loop;
      loop.running = true; last = 0; acc = 0;
      raf = requestAnimationFrame(frame);
      return loop;
    },
    stop() { loop.running = false; cancelAnimationFrame(raf); },
    pause(reason = 'manual') { loop.paused = true; loop.pauseReason = reason; },
    resume() { loop.paused = false; loop.pauseReason = null; acc = 0; last = 0; },
    /** Freeze updates for `seconds` of real time (rendering continues). Stacks by max, not sum. */
    hitstop(seconds) { loop.hitstopLeft = Math.max(loop.hitstopLeft, seconds || 0); },
  };

  function safe(fn, arg, label) {
    if (!fn) return;
    try { fn(arg); } catch (err) {
      loop.errors++; loop.lastError = err;
      errorCount++;
      if (errorCount <= 5 || errorCount % 300 === 0) console.error(`[loop] ${label} error (#${errorCount}):`, err);
    }
  }

  function frame(now) {
    if (!loop.running) return;
    raf = requestAnimationFrame(frame);
    let dt = last ? (now - last) / 1000 : 0;
    last = now;
    if (!(dt > 0)) dt = 0; // also catches NaN
    if (dt > maxFrame) dt = maxFrame;
    loop.realTime += dt;
    if (dt > 0) loop.fps += (1 / dt - loop.fps) * 0.05;

    if (!loop.paused) {
      if (loop.hitstopLeft > 0) {
        const h = Math.min(loop.hitstopLeft, dt);
        loop.hitstopLeft -= h; dt -= h;
      }
      acc += dt;
      let n = 0;
      while (acc >= step) {
        if (n >= maxSteps) { acc = 0; break; } // drop backlog: no spiral of death
        acc -= step; n++;
        if (loop.timeScale > 0) {
          const sdt = step * loop.timeScale;
          loop.time += sdt; loop.steps++;
          safe(update, sdt, 'update');
        }
      }
    }
    loop.alpha = acc / step;
    safe(render, dt, 'render');
    loop.frame++;
  }

  if (autoPause && typeof document !== 'undefined') {
    const autoPauseNow = (reason) => {
      if (reason === 'hidden') last = 0; // no giant dt when we come back
      if (loop.onAutoPause) { try { loop.onAutoPause(reason); } catch (e) { console.error(e); } return; }
      if (!loop.paused) loop.pause(reason);
    };
    const autoResume = (reason) => {
      if (document.hidden) return;
      last = 0;
      if (loop.paused && (loop.pauseReason === 'hidden' || loop.pauseReason === 'blur')) loop.resume();
      if (loop.onAutoResume) try { loop.onAutoResume(reason); } catch (e) { console.error(e); }
    };
    document.addEventListener('visibilitychange', () => (document.hidden ? autoPauseNow('hidden') : autoResume('visible')));
    window.addEventListener('pagehide', () => autoPauseNow('hidden'));
    window.addEventListener('pageshow', () => autoResume('visible'));
    window.addEventListener('blur', () => autoPauseNow('blur'));
    window.addEventListener('focus', () => autoResume('focus'));
    const onInput = () => { if (loop.paused && loop.pauseReason === 'blur') autoResume('input'); };
    window.addEventListener('pointerdown', onInput, true);
    window.addEventListener('keydown', onInput, true);
  }

  return loop;
}
