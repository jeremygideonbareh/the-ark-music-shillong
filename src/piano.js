import { gsap } from 'gsap';
import { playNote, midiToFreq, audio } from './audio.js';

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const BLACK = new Set([1, 3, 6, 8, 10]);
// Computer keyboard → semitone offset from the lowest C (DAW-style layout)
const KEYMAP = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16 };
const LABEL = Object.fromEntries(Object.entries(KEYMAP).map(([k, v]) => [v, k.toUpperCase()]));

export function createPiano(root, { strings, reduced = false, onPress } = {}) {
  const wrap = root.querySelector('.piano__keys');
  const mq = window.matchMedia('(max-width: 640px)');
  let keysByOffset = new Map();
  const low = 60; // C4

  function build() {
    wrap.innerHTML = '';
    keysByOffset = new Map();
    const span = mq.matches ? 16 : 24; // semitones: up to E5 on phones, C6 on larger screens
    const whites = [];
    for (let o = 0; o <= span; o++) if (!BLACK.has((low + o) % 12)) whites.push(o);
    const w = 100 / whites.length;
    wrap.style.setProperty('--w', `${w}%`);

    whites.forEach((o) => {
      const b = makeKey(o, false);
      wrap.appendChild(b);
    });
    for (let o = 0; o <= span; o++) {
      if (!BLACK.has((low + o) % 12)) continue;
      const leftWhiteIndex = whites.findIndex((x) => x > o);
      const b = makeKey(o, true);
      b.style.left = `${leftWhiteIndex * w}%`;
      wrap.appendChild(b);
    }
  }

  function makeKey(offset, black) {
    const midi = low + offset;
    const name = `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `key${black ? ' key--black' : ''}`;
    b.setAttribute('aria-label', `Play ${name}`);
    b.dataset.offset = offset;
    b.tabIndex = offset === 0 ? 0 : -1; // one tab stop for the keyboard (roving tabindex)
    if (LABEL[offset] !== undefined) b.innerHTML = `<span aria-hidden="true">${LABEL[offset]}</span>`;
    keysByOffset.set(offset, b);
    return b;
  }

  function press(offset, { velocity = 0.75 } = {}) {
    const key = keysByOffset.get(offset);
    if (!key) return;
    const midi = low + offset;
    if (!audio.enabled) audio.setEnabled(true); // playing the piano is an explicit request for sound
    playNote(midiToFreq(midi), { velocity, duration: 2.4 });
    if (strings) key.style.setProperty('--kc', `rgb(${strings.colors[offset % strings.count]})`);
    key.classList.add('is-down');
    setTimeout(() => key.classList.remove('is-down'), 180);

    // pluck the string that matches this pitch, at the key's horizontal position
    if (strings) {
      const r = key.getBoundingClientRect();
      const xNorm = (r.left + r.width / 2) / window.innerWidth;
      strings.pluck(offset % strings.count, xNorm, (offset % 2 ? -1 : 1) * (5 + velocity * 4));
    }
    if (!reduced) flyNote(key);
    onPress?.(offset);
  }

  const GLYPHS = ['♪', '♫', '♩', '♬'];
  function flyNote(key) {
    const r = key.getBoundingClientRect();
    const host = root.getBoundingClientRect();
    const n = document.createElement('span');
    n.className = 'note-fly';
    n.setAttribute('aria-hidden', 'true');
    n.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    n.style.color = key.style.getPropertyValue('--kc') || '#ff4f9a';
    n.style.left = `${r.left - host.left + r.width / 2 - 8}px`;
    n.style.top = `${r.top - host.top - 10}px`;
    root.appendChild(n);
    gsap.fromTo(n, { y: 0, opacity: 1, scale: 0.6, rotate: 0 }, {
      y: -120 - Math.random() * 80,
      x: (Math.random() - 0.5) * 80,
      rotate: (Math.random() - 0.5) * 60,
      scale: 1.2,
      opacity: 0,
      duration: 1.6,
      ease: 'power2.out',
      onComplete: () => n.remove(),
    });
  }

  // Pointer: press + glissando while held
  let held = false;
  function onDown(e) {
    const k = e.target.closest('.key');
    if (!k) return;
    held = true;
    try { k.releasePointerCapture?.(e.pointerId); } catch (_) { /* noop */ }
    press(+k.dataset.offset);
  }
  function onOver(e) {
    if (!held) return;
    const k = e.target.closest('.key');
    if (k) press(+k.dataset.offset, { velocity: 0.55 });
  }
  function onUp() { held = false; }
  function onKeyClick(e) {
    // keyboard activation (Enter/Space) — pointer presses are handled on pointerdown
    if (e.detail === 0) {
      const k = e.target.closest('.key');
      if (k) press(+k.dataset.offset);
    }
  }
  const down = new Set();
  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) return;
    const off = KEYMAP[e.key.toLowerCase()];
    if (off === undefined || down.has(off)) return;
    // only when the hero is on screen
    const r = root.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    down.add(off);
    press(off);
  }
  function onKeyUp(e) { const off = KEYMAP[e.key?.toLowerCase()]; if (off !== undefined) down.delete(off); }

  function onArrow(e) {
    const k = e.target.closest('.key');
    if (!k || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const offs = [...keysByOffset.keys()].sort((a, b) => a - b);
    let i = offs.indexOf(+k.dataset.offset);
    if (e.key === 'ArrowLeft') i = Math.max(0, i - 1);
    if (e.key === 'ArrowRight') i = Math.min(offs.length - 1, i + 1);
    if (e.key === 'Home') i = 0;
    if (e.key === 'End') i = offs.length - 1;
    const next = keysByOffset.get(offs[i]);
    k.tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
  }

  build();
  wrap.addEventListener('keydown', onArrow);
  mq.addEventListener('change', build);
  wrap.addEventListener('pointerdown', onDown);
  wrap.addEventListener('pointerover', onOver);
  wrap.addEventListener('click', onKeyClick);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);

  return {
    keys: () => [...wrap.querySelectorAll('.key')],
    destroy() {
      mq.removeEventListener('change', build);
      wrap.removeEventListener('pointerdown', onDown);
      wrap.removeEventListener('pointerover', onOver);
      wrap.removeEventListener('click', onKeyClick);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    },
  };
}
