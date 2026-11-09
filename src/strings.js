// Five vibrating strings — the musical staff as a living instrument.
// Simple 1D wave simulation per string; pointer crossings pluck them, piano keys pluck them too.

export function createStrings(canvas, { onPluck, reduced = false, getCenter } = {}) {
  const COLORS = ['255,79,154', '255,194,26', '47,191,113', '46,168,255', '143,107,255'];
  let center = 0;
  const ctx = canvas.getContext('2d');
  const N = 5;
  const P = 110;
  const strings = Array.from({ length: N }, () => ({
    y: 0,
    pos: new Float32Array(P),
    vel: new Float32Array(P),
    energy: 0,
    lastSound: 0,
  }));

  let W = 0, H = 0, dpr = 1, spacing = 22;
  let spread = 1;          // scroll-driven: strings fan apart as the hero leaves
  let fade = 1;
  let visible = true;
  let raf = 0;
  let running = false;
  const pointer = { x: -1, y: -1, px: -1, py: -1, has: false, last: 0 };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    spacing = Math.max(12, Math.min(26, W * 0.015));
    center = getCenter ? getCenter() : H * 0.6;
    if (reduced) draw(0);
  }

  function baseY(i) {
    return center + (i - 2) * spacing * spread;
  }

  function pluck(i, xNorm, amp) {
    const s = strings[i];
    if (!s) return;
    const sigma = 0.035;
    for (let p = 1; p < P - 1; p++) {
      const d = p / (P - 1) - xNorm;
      s.vel[p] += amp * Math.exp(-(d * d) / (2 * sigma * sigma));
    }
    if (reduced) draw(0);
  }

  function glissando(delay = 70) {
    for (let i = 0; i < N; i++) {
      setTimeout(() => pluck(i, 0.2 + i * 0.15, (i % 2 ? -1 : 1) * 5), i * delay);
    }
  }

  function step() {
    for (let k = 0; k < 2; k++) {
      for (const s of strings) {
        const { pos, vel } = s;
        for (let p = 1; p < P - 1; p++) vel[p] += 0.48 * (pos[p - 1] + pos[p + 1] - 2 * pos[p]);
        let e = 0;
        for (let p = 1; p < P - 1; p++) {
          vel[p] *= 0.986;
          pos[p] += vel[p];
          const a = Math.abs(pos[p]);
          if (a > e) e = a;
        }
        s.energy = e;
      }
    }
  }

  function checkPointer(now) {
    if (!pointer.has || pointer.px < 0) return;
    const { x, y, px, py } = pointer;
    if (x === px && y === py) return;
    for (let i = 0; i < N; i++) {
      const sy = baseY(i);
      if ((py - sy) * (y - sy) < 0) {
        const xNorm = Math.min(0.98, Math.max(0.02, x / W));
        const amp = Math.max(-9, Math.min(9, (y - py) * 0.45));
        pluck(i, xNorm, amp);
        const s = strings[i];
        if (onPluck && now - s.lastSound > 110) {
          s.lastSound = now;
          onPluck(i, Math.min(1, Math.abs(amp) / 9));
        }
      }
    }
    pointer.px = x;
    pointer.py = y;
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    const step = W / (P - 1);
    for (let i = 0; i < N; i++) {
      const s = strings[i];
      const y0 = baseY(i);
      const amb = reduced ? 0 : 1.1;
      const glow = Math.min(1, s.energy / 10);

      const col = COLORS[i];
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, 'rgba(21,18,43,0)');
      grad.addColorStop(0.1, `rgba(21,18,43,${0.55 * fade})`);
      grad.addColorStop(0.9, `rgba(21,18,43,${0.55 * fade})`);
      grad.addColorStop(1, 'rgba(21,18,43,0)');
      ctx.beginPath();
      for (let p = 0; p < P; p++) {
        const x = p * step;
        const y = y0 + s.pos[p] + Math.sin(t * 0.0009 + p * 0.07 + i * 1.3) * amb * Math.sin((p / (P - 1)) * Math.PI);
        if (p === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      if (glow > 0.04) {
        ctx.strokeStyle = `rgba(${col},${Math.min(0.9, 0.25 + glow * 0.7) * fade})`;
        ctx.lineWidth = 3 + glow * 6;
        ctx.stroke();
      }
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    checkPointer(t);
    step();
    draw(t);
  }

  function start() {
    if (running || reduced) return;
    running = true;
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }
  function sync() {
    if (visible && !document.hidden) start(); else stop();
  }

  let lastMove = 0;
  function onMove(e) {
    const now = performance.now();
    if (now - lastMove < 12) return; // throttle
    lastMove = now;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (!pointer.has) { pointer.px = x; pointer.py = y; }
    pointer.x = x; pointer.y = y; pointer.has = true;
  }
  function onLeave() { pointer.has = false; pointer.px = -1; }

  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
  io.observe(canvas);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('blur', onLeave);
  document.documentElement.addEventListener('pointerleave', onLeave);

  resize();
  if (reduced) draw(0); else sync();

  return {
    pluck,
    glissando,
    count: N,
    colors: COLORS,
    resize,
    setSpread(v) { spread = v; if (reduced) draw(0); },
    setFade(v) { fade = v; },
    destroy() {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('blur', onLeave);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    },
  };
}
