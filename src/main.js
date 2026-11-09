import './style.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { audio, chime } from './audio.js';
import { createStrings } from './strings.js';
import { createPiano } from './piano.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
// "Calm" = OS reduced-motion preference, unless the visitor chose otherwise with the Motion toggle.
const reduced = root.classList.contains('reduce-motion');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const PALETTE = ['#ff4f9a', '#ffc21a', '#2fbf71', '#2ea8ff', '#8f6bff', '#ff7a1a'];
// Order in which letters "drip" — like EQ bands dropping out of sync.
const DRIP = [2, 0, 4, 1, 5, 3, 6];

/* ---------------- Icons (Solar + Simple Icons via Iconify, inlined at build) ---------------- */
const icons = import.meta.glob('./icons/*.svg', { query: '?raw', import: 'default', eager: true });
$$('[data-icon]').forEach((el) => {
  const svg = icons[`./icons/${el.dataset.icon}.svg`];
  if (svg) { el.innerHTML = svg; el.setAttribute('aria-hidden', 'true'); }
});

/* ---------------- Motion toggle (Full / Calm), remembered per visitor ---------------- */
$$('[data-motion-toggle]').forEach((btn) => {
  btn.setAttribute('aria-pressed', String(!reduced));
  $('.pill-toggle__text', btn).textContent = reduced ? 'Motion: calm' : 'Motion: full';
  btn.addEventListener('click', () => {
    try { localStorage.setItem('ark-motion', reduced ? 'full' : 'calm'); } catch (_) { /* private mode */ }
    window.location.reload();
  });
});

/* ---------------- Smooth scroll (Lenis — the single engine) ---------------- */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  if (id.length < 2) return;
  const target = document.querySelector(id);
  if (!target) return;
  e.preventDefault();
  closeMenu();
  if (lenis) lenis.scrollTo(target, { duration: 1.6 });
  else target.scrollIntoView();
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  setTimeout(() => target.focus({ preventScroll: true }), lenis ? 1300 : 30);
});

/* ---------------- Sound ---------------- */
const soundBtn = $('[data-sound-toggle]');
audio.onChange((on) => {
  soundBtn.setAttribute('aria-pressed', String(on));
  $('.pill-toggle__text', soundBtn).textContent = on ? 'Sound on' : 'Sound off';
});
soundBtn.addEventListener('click', () => {
  audio.setEnabled(!audio.enabled);
  if (audio.enabled) chime(3, 0.5);
});
$$('[data-sound]').forEach((el, i) => el.addEventListener('pointerenter', () => chime(i, 0.22)));

/* ---------------- Hero instrument: strings + piano + bouncing letters ---------------- */
const hero = $('.hero');
const heroWord = $('.hero__word');
const heroLetters = $$('.l:not(.l--gap)', heroWord);
const strings = createStrings($('.hero__strings'), {
  reduced,
  getCenter: () => {
    const h = hero.getBoundingClientRect();
    const w = heroWord.getBoundingClientRect();
    return w.top - h.top + w.height * 0.52;
  },
  onPluck: (i, amt) => { if (audio.enabled) chime(i * 2 + 1, 0.15 + amt * 0.3); },
});
createPiano($('[data-piano]'), {
  strings,
  reduced,
  onPress: (offset) => {
    if (reduced) return;
    const l = heroLetters[offset % heroLetters.length];
    gsap.timeline().to(l, { y: -28, duration: 0.12, ease: 'power2.out' }).to(l, { y: 0, duration: 0.9, ease: 'elastic.out(1, 0.3)' });
  },
});
window.addEventListener('load', () => strings.resize());

/* ---------------- Mobile menu ---------------- */
const menu = $('#menu');
const menuOpenBtn = $('[data-menu-open]');
function openMenu() {
  menu.hidden = false;
  menuOpenBtn.setAttribute('aria-expanded', 'true');
  lenis?.stop();
  if (!reduced) gsap.fromTo($$('nav a', menu), { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.05, duration: 0.7, ease: 'expo.out' });
  $('[data-menu-close]').focus();
}
function closeMenu() {
  if (menu.hidden) return;
  menu.hidden = true;
  menuOpenBtn.setAttribute('aria-expanded', 'false');
  lenis?.start();
  menuOpenBtn.focus({ preventScroll: true });
}
menuOpenBtn.addEventListener('click', openMenu);
$('[data-menu-close]').addEventListener('click', closeMenu);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMenu();
  if (e.key === 'Tab' && !menu.hidden) {
    const f = $$('a, button', menu);
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
});

/* ---------------- Enquiry form → WhatsApp ---------------- */
const form = $('[data-enquiry]');
const nameInput = $('#f-name');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  const inst = form.querySelector('input[name="instrument"]:checked');
  nameInput.closest('.field').classList.toggle('is-error', !name);
  nameInput.setAttribute('aria-invalid', String(!name));
  $('#f-name-err').textContent = name ? '' : 'Please tell us your name.';
  form.querySelector('fieldset').classList.toggle('fieldset-error', !inst);
  $('#f-inst-err').textContent = inst ? '' : 'Choose an instrument or voice.';
  if (!name || !inst) {
    (name ? form.querySelector('input[name="instrument"]') : nameInput).focus();
    if (!reduced) gsap.fromTo(form, { x: -10 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
    return;
  }
  const btn = form.querySelector('button[type="submit"]');
  const label = $('.btn__label', btn);
  btn.disabled = true;
  label.textContent = 'Opening WhatsApp…';
  const msg = `Hello The ARK Music! I'd like a trial class.\nName: ${name}\nInstrument: ${inst.value}\nLearner: ${form.age.value}\nMode: ${form.mode.value}`;
  const win = window.open(`https://wa.me/917795864119?text=${encodeURIComponent(msg)}`, '_blank');
  if (win) win.opener = null;
  $('.enquiry__status', form).textContent = win !== null
    ? 'WhatsApp opened in a new tab — just press send.'
    : 'Pop-up blocked? Message us on WhatsApp at +91 77958 64119.';
  chime(5, 0.4);
  setTimeout(() => { btn.disabled = false; label.textContent = 'Send on WhatsApp'; }, 1600);
});
form.addEventListener('input', (e) => {
  if (e.target === nameInput && nameInput.value.trim()) { nameInput.closest('.field').classList.remove('is-error'); nameInput.setAttribute('aria-invalid', 'false'); $('#f-name-err').textContent = ''; }
  if (e.target.name === 'instrument') { form.querySelector('fieldset').classList.remove('fieldset-error'); $('#f-inst-err').textContent = ''; }
});

/* ---------------- Cursor + magnetic (fine pointers, full motion) ---------------- */
if (finePointer && !reduced) {
  const cursor = $('.cursor');
  const dot = $('.cursor__dot');
  const ring = $('.cursor__ring');
  const label = $('.cursor__label');
  const dx = gsap.quickTo(dot, 'x', { duration: 0.08 });
  const dy = gsap.quickTo(dot, 'y', { duration: 0.08 });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
  window.addEventListener('pointermove', (e) => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); cursor.classList.remove('is-hidden'); }, { passive: true });
  root.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));
  window.addEventListener('blur', () => cursor.classList.add('is-hidden'));
  document.addEventListener('pointerover', (e) => {
    const lab = e.target.closest('[data-cursor]');
    const link = e.target.closest('a, button, label, select, input');
    cursor.classList.toggle('is-label', !!lab && !link);
    cursor.classList.toggle('is-link', !!link);
    label.textContent = lab && !link ? lab.dataset.cursor : '';
  });
  $$('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.3);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}

/* ---------------- Marquee: velocity-reactive, flips with scroll direction ---------------- */
function setupMarquee() {
  const row = $('[data-marquee]');
  const track = $('.marquee__track', row);
  for (let i = 0; i < 3; i++) row.appendChild(track.cloneNode(true));
  if (reduced) return;
  const tracks = $$('.marquee__track', row);
  let w = track.offsetWidth;
  new ResizeObserver(() => (w = track.offsetWidth)).observe(track);
  let x = 0, boost = 0, dir = 1, visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(row);
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => { dir = self.direction; boost = Math.min(16, Math.abs(self.getVelocity()) / 200); } });
  gsap.ticker.add((_, delta) => {
    boost *= 0.94;
    if (!visible) return;
    x -= (1 + boost) * dir * (delta / 16.67);
    if (x <= -w) x += w;
    if (x > 0) x -= w;
    tracks.forEach((t) => (t.style.transform = `translate3d(${x}px,0,0)`));
  });
}

/* ---------------- Score: 12 bars × 4 beats = 48 lessons ---------------- */
function buildScore() {
  const score = $('.score');
  for (let b = 0; b < 12; b++) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.setProperty('--bc', PALETTE[b % PALETTE.length]);
    bar.innerHTML = `<span class="bar__label">M${String(b + 1).padStart(2, '0')}</span>` + '<i class="beat"></i>'.repeat(4);
    score.appendChild(bar);
  }
  return $$('.beat', score);
}

/* ---------------- Duotone → colour scan layers ---------------- */
function buildScans() {
  return $$('[data-scan]').map((wrap) => {
    const img = $('img', wrap);
    const layer = document.createElement('div');
    layer.className = 'scan-color';
    layer.setAttribute('aria-hidden', 'true');
    const clone = img.cloneNode();
    clone.alt = '';
    clone.removeAttribute('loading');
    layer.appendChild(clone);
    wrap.appendChild(layer);
    wrap.classList.add('is-duo');
    return { wrap, layer };
  });
}

/* ---------------- Chapter indicator ---------------- */
const chapNum = $('.nav__chapter-num');
const chapName = $('.nav__chapter-name');
let currentChapter = 'Overture';
function setChapter(num, name) {
  if (name === currentChapter) return;
  currentChapter = name;
  if (reduced) { chapNum.textContent = num; chapName.textContent = name; return; }
  gsap.timeline()
    .to(chapName, { yPercent: -110, duration: 0.25, ease: 'power2.in' })
    .add(() => { chapNum.textContent = num; chapName.textContent = name; })
    .fromTo(chapName, { yPercent: 110 }, { yPercent: 0, duration: 0.5, ease: 'expo.out' });
}

/* =================================================================
   Boot
   ================================================================= */
const beats = buildScore();
setupMarquee();
const scoreN = $('.score__n');
const scoreM = $('.score__m');
const paintScore = (n) => {
  beats.forEach((b, i) => b.classList.toggle('is-on', i < n));
  scoreN.textContent = String(Math.max(1, n)).padStart(2, '0');
  scoreM.textContent = `Month ${Math.max(1, Math.ceil(n / 4))}`;
};

const nav = $('[data-nav]');
(document.fonts?.ready || Promise.resolve()).then(() => {
  $$('[data-chapter]').forEach((sec) => {
    ScrollTrigger.create({ trigger: sec, start: 'top 55%', end: 'bottom 55%', onToggle: (self) => self.isActive && setChapter(sec.dataset.num, sec.dataset.chapter) });
  });
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (self) => {
      const y = self.scroll();
      nav.classList.toggle('is-solid', y > 60);
      if (!menu.hidden) return;
      nav.classList.toggle('is-hidden', self.direction === 1 && y > window.innerHeight * 0.8);
    },
  });
  nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));
  const dock = $('[data-dock]');
  const dockState = { hero: true, adm: false };
  const syncDock = () => dock.classList.toggle('is-away', dockState.hero || dockState.adm || dockState.foot);
  ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: 'bottom 40%', onToggle: (self) => { dockState.hero = self.isActive; syncDock(); } });
  ScrollTrigger.create({ trigger: '.admissions', start: 'top 80%', end: 'bottom top', onToggle: (self) => { dockState.adm = self.isActive; syncDock(); } });
  ScrollTrigger.create({ trigger: '.footer', start: 'top bottom', end: 'bottom top', onToggle: (self) => { dockState.foot = self.isActive; syncDock(); } });

  if (reduced) {
    paintScore(48);
    buildStaffSeams();
    $$('.learn__list li').forEach((li) => li.classList.add('is-in'));
    strings.resize();
    return;
  }
  buildMotion();
  window.addEventListener('load', () => ScrollTrigger.refresh());
});

function melt(letters, from, to) {
  const tl = gsap.timeline();
  tl.fromTo(letters, { scaleY: from }, { scaleY: to, ease: 'none', duration: 0.6, stagger: (i) => DRIP[i % DRIP.length] * 0.08 }, 0);
  return tl;
}

function buildMotion() {
  const scans = buildScans();
  runLoader().then(heroIntro);

  /* ---- Overture exit: THE ARK drops like an EQ, cover & cards drift ---- */
  gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom 15%', scrub: true,
    onUpdate: (self) => { strings.setSpread(1 + self.progress * 2.4); strings.setFade(1 - self.progress * 0.7); } } })
    .add(melt(heroLetters, 1, 0.32), 0)
    .to('.hero__cover', { yPercent: -18, ease: 'none' }, 0)
    .to('.hero__cover img', { yPercent: -10, ease: 'none' }, 0)
    .to('.hero__date', { yPercent: -80, rotate: 4, ease: 'none' }, 0)
    .to('.hero__box', { yPercent: -30, rotate: -2, ease: 'none' }, 0)
    .to('.seal', { yPercent: -120, rotate: 140, ease: 'none' }, 0)
    .to('.piano', { y: 60, opacity: 0.2, ease: 'none' }, 0);

  /* ---- Chapter I entry: MUSIC grows down out of the seam ---- */
  gsap.timeline({ scrollTrigger: { trigger: '.ark', start: 'top bottom', end: 'top 15%', scrub: true } })
    .add(melt($$('.ark__word .l'), 0.04, 1), 0);

  /* ---- Word-by-word heading reveals ---- */
  $$('[data-split]').forEach((el) => {
    if (el.closest('.recital__title')) return;
    const split = SplitText.create(el, { type: 'words', mask: 'words', wordsClass: 'sw' });
    gsap.from(split.words, { yPercent: 110, rotate: 5, duration: 1.1, ease: 'expo.out', stagger: 0.06,
      scrollTrigger: { trigger: el, start: 'top 86%', once: true } });
  });

  /* ---- Manifesto: words light up as you read ---- */
  const man = $('[data-scrub-text]');
  const manSplit = SplitText.create(man, { type: 'words', wordsClass: 'w' });
  gsap.fromTo(manSplit.words, { opacity: 0.15, color: '#ffc21a' }, { opacity: 1, color: '#f6f1e7', ease: 'none', stagger: 0.1,
    scrollTrigger: { trigger: man, start: 'top 80%', end: 'bottom 45%', scrub: true } });

  /* ---- Image reveals ---- */
  $$('[data-reveal-img]').forEach((fig) => {
    gsap.fromTo(fig, { clipPath: 'inset(100% 0% 0% 0% round 24px)' }, { clipPath: 'inset(0% 0% 0% 0% round 24px)', duration: 1.4, ease: 'expo.inOut',
      scrollTrigger: { trigger: fig, start: 'top 85%', once: true } });
    gsap.fromTo($('img', fig), { yPercent: -12 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  gsap.from('.founder', { y: 80, rotate: 3, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.founder', start: 'top 85%', once: true } });

  /* ---- II. Horizontal voices with the centre playhead scan ---- */
  const vSection = $('.voices');
  const track = $('.voices__track');
  const voiceScans = scans.filter((s) => s.wrap.closest('.voices'));
  const travel = () => Math.max(0, track.scrollWidth - window.innerWidth);
  const paintScans = () => {
    const cx = window.innerWidth / 2;
    voiceScans.forEach((s, i) => {
      const r = s.wrap.getBoundingClientRect();
      const crossed = gsap.utils.clamp(0, 1, (cx - r.left) / r.width);
      s.layer.style.clipPath = `inset(0 ${(1 - crossed) * 100}% 0 0)`;
      const side = crossed > 0.5;
      if (s.side !== undefined && side !== s.side) chime(i * 2 + 2, 0.3);
      s.side = side;
    });
  };
  const hTween = gsap.to(track, {
    x: () => -travel(), ease: 'none',
    scrollTrigger: {
      trigger: vSection, start: 'top top', end: () => `+=${travel()}`, pin: true, scrub: 0.8,
      invalidateOnRefresh: true, anticipatePin: 1,
      onUpdate: (self) => { gsap.set('.voices__progress i', { scaleX: self.progress }); paintScans(); },
      onRefresh: paintScans,
    },
  });
  gsap.ticker.add(() => { if (ScrollTrigger.isInViewport(vSection)) paintScans(); });
  $$('.voice').forEach((v, i) => {
    gsap.fromTo(v, { rotate: i % 2 ? 4 : -4, y: i % 2 ? 30 : -20 }, { rotate: i % 2 ? -3 : 3, y: i % 2 ? -20 : 30, ease: 'none',
      scrollTrigger: { containerAnimation: hTween, trigger: v, start: 'left right', end: 'right left', scrub: true } });
  });
  gsap.from('.voice__swara span', { yPercent: 140, scale: 0.4, stagger: 0.06, ease: 'back.out(2.4)', duration: 0.8,
    scrollTrigger: { containerAnimation: hTween, trigger: '.voice--type', start: 'left 70%', toggleActions: 'play none none reverse' } });

  /* ---- III. Course: score fills, stat bars rise, list draws ---- */
  ScrollTrigger.create({ trigger: '.method__score', start: 'top 85%', end: 'bottom 35%', scrub: true, onUpdate: (self) => paintScore(Math.round(self.progress * 48)) });
  paintScore(0);
  $$('.stat').forEach((s, i) => {
    gsap.fromTo($('.stat__bar', s), { scaleY: 0.16 }, { scaleY: 1, duration: 1.2, ease: 'expo.out', delay: i * 0.08, scrollTrigger: { trigger: s, start: 'top 88%', once: true } });
  });
  $$('[data-count]').forEach((el) => {
    gsap.fromTo(el, { textContent: 0 }, { textContent: +el.dataset.count, duration: 1.8, ease: 'power2.out', snap: { textContent: 1 }, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });
  $$('.learn__list li').forEach((li) => {
    gsap.from(li, { xPercent: -6, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: li, start: 'top 92%', once: true, onEnter: () => li.classList.add('is-in') } });
  });

  /* ---- IV. Practice room: photos dealt off a pile ---- */
  const wall = $('.room__wall');
  const snaps = $$('.snap', wall).filter((s) => s.offsetParent !== null);
  const turns = [-12, 8, -5, 10, -8, 5];
  const pileX = (s) => wall.clientWidth / 2 - (s.offsetLeft + s.offsetWidth / 2);
  const pileY = (s) => wall.clientHeight / 2 - (s.offsetTop + s.offsetHeight / 2);
  snaps.forEach((s, i) => (s.style.zIndex = String(snaps.length - i)));
  const stage = $('.room__stage');
  const canPin = () => stage.offsetHeight <= window.innerHeight + 4;
  const deal = gsap.timeline({
    scrollTrigger: canPin()
      ? { trigger: stage, start: 'top top', end: () => `+=${Math.round(window.innerHeight * 1.6)}`, pin: true, scrub: 0.8, invalidateOnRefresh: true }
      : { trigger: wall, start: 'top 85%', end: 'bottom 45%', scrub: 0.8, invalidateOnRefresh: true },
  });
  snaps.forEach((s, order) => {
    const i = snaps.indexOf(s);
    deal.fromTo(s, { x: () => pileX(s), y: () => pileY(s), rotation: turns[i % turns.length], scale: 0.72 },
      { x: 0, y: 0, rotation: (i % 2 ? 1.5 : -1.5), scale: 1, duration: 1, ease: 'power2.inOut' }, order * 0.4);
  });
  deal.to({}, { duration: 0.4 });

  /* ---- V. Recital: stage opens, a light band sweeps across ---- */
  const recSplit = SplitText.create($('.recital__title .display'), { type: 'words', mask: 'words' });
  gsap.timeline({ scrollTrigger: { trigger: '.recital__pin', start: 'top top', end: '+=150%', pin: true, scrub: 1, anticipatePin: 1 } })
    .fromTo('.recital__frame', { clipPath: () => (window.innerWidth < 700 ? 'inset(32% 6% 32% 6% round 18px)' : 'inset(24% 30% 24% 30% round 24px)') }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'power2.inOut', duration: 1 }, 0)
    .fromTo('.recital__frame img', { scale: 1.35 }, { scale: 1, ease: 'power2.inOut', duration: 1 }, 0)
    .fromTo('.recital__band', { top: '-30%' }, { top: '110%', ease: 'none', duration: 1.2 }, 0.1)
    .fromTo('.recital__shade', { opacity: 0.15 }, { opacity: 1, duration: 0.6 }, 0.45)
    .from('.recital__title .eyebrow', { opacity: 0, y: 20, duration: 0.3 }, 0.6)
    .from(recSplit.words, { yPercent: 110, stagger: 0.05, duration: 0.4, ease: 'power3.out' }, 0.65)
    .to({}, { duration: 0.3 });
  $$('.prog').forEach((li, i) => {
    gsap.from(li, { xPercent: i % 2 ? 12 : -12, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: li, start: 'top 94%', once: true } });
  });
  if (finePointer) {
    const preview = $('.preview');
    const pImg = $('img', preview);
    const px = gsap.quickTo(preview, 'x', { duration: 0.55, ease: 'power3' });
    const py = gsap.quickTo(preview, 'y', { duration: 0.55, ease: 'power3' });
    const pr = gsap.quickTo(preview, 'rotate', { duration: 0.8, ease: 'power3' });
    let lastX = 0;
    const list = $('.programme__list');
    list.addEventListener('pointermove', (e) => { px(e.clientX + 28); py(e.clientY - 100); pr(gsap.utils.clamp(-12, 12, (e.clientX - lastX) * 0.6)); lastX = e.clientX; });
    $$('.prog').forEach((li, i) => li.addEventListener('pointerenter', (e) => {
      if (gsap.getProperty(preview, 'opacity') < 0.05) gsap.set(preview, { x: e.clientX + 28, y: e.clientY - 100 });
      px(e.clientX + 28); py(e.clientY - 100); lastX = e.clientX;
      pImg.src = li.dataset.preview;
      gsap.to(preview, { opacity: 1, scale: 1, duration: 0.45, ease: 'expo.out' });
      chime(i + 2, 0.25);
    }));
    list.addEventListener('pointerleave', () => gsap.to(preview, { opacity: 0, scale: 0.6, duration: 0.35, ease: 'power2.in' }));
  }

  /* ---- VI. Standard: cards rise (the pinned name band lives in buildRound3) ---- */
  $$('.card-std').forEach((c, i) => {
    gsap.fromTo(c, { scaleY: 0.16, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 1.05, ease: 'expo.out', delay: i * 0.1, scrollTrigger: { trigger: c, start: 'top 90%', once: true } });
  });
  gsap.from('.why li', { scale: 0.5, opacity: 0, stagger: 0.06, duration: 0.8, ease: 'back.out(2.2)', scrollTrigger: { trigger: '.why', start: 'top 92%', once: true } });

  /* ---- The sun that spans the seam into Admissions ---- */
  gsap.set('.seam-sun', { y: 0, yPercent: 50 });
  gsap.set('.admissions__sun', { y: 0, yPercent: -50 });
  // one trigger drives both halves so the disc stays continuous across the seam
  gsap.fromTo(['.seam-sun', '.admissions__sun'], { scale: 0.3 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.admissions', start: 'top bottom', end: 'top 30%', scrub: true } });
  gsap.to('.admissions__sun', { rotate: 90, ease: 'none', scrollTrigger: { trigger: '.admissions', start: 'top top', end: 'bottom top', scrub: true } });

  /* ---- VII. Admissions ---- */
  gsap.from('.contact > *', { y: 40, opacity: 0, stagger: 0.08, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.contact', start: 'top 85%', once: true } });
  gsap.from('.enquiry', { y: 90, rotate: 3, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.enquiry', start: 'top 90%', once: true } });

  /* ---- Footer: the name rises back up ---- */
  gsap.timeline({ scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } })
    .add(melt($$('.footer__word .l:not(.l--gap)'), 0.2, 1), 0);

  buildRound3(hTween);

  /* ---- Rail note travels the whole story ---- */
  gsap.to('.rail__note', { top: '100%', ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.4 } });
}

/* ---------------- Loader → hero intro ---------------- */
function runLoader() {
  return new Promise((resolve) => {
    const loader = $('.loader');
    const num = $('.loader__num');
    lenis?.stop();
    window.scrollTo(0, 0);
    const bars = $$('.loader__eq i');
    const bounce = bars.map((b) => gsap.to(b, { scaleY: () => gsap.utils.random(0.2, 1), duration: () => gsap.utils.random(0.18, 0.35), repeat: -1, yoyo: true, repeatRefresh: true, ease: 'sine.inOut' }));
    const counter = { v: 0 };
    gsap.to(counter, { v: 88, duration: 1.2, ease: 'power2.out', onUpdate: () => (num.textContent = Math.round(counter.v)) });
    const pageReady = new Promise((r) => (document.readyState === 'complete' ? r() : window.addEventListener('load', r, { once: true })));
    const minTime = new Promise((r) => setTimeout(r, 1250));
    Promise.all([pageReady, minTime]).then(() => {
      bounce.forEach((t) => t.kill());
      gsap.timeline({ onComplete: () => { loader.remove(); lenis?.start(); } })
        .to(counter, { v: 100, duration: 0.35, onUpdate: () => (num.textContent = Math.round(counter.v)) })
        .to(bars, { scaleY: 1, duration: 0.45, stagger: 0.04, ease: 'back.out(2)' }, '<')
        .to(bars, { yPercent: -160, duration: 0.6, stagger: 0.04, ease: 'expo.in' }, '+=0.05')
        .to('.loader__meta', { opacity: 0, duration: 0.3 }, '<')
        .to(loader, { yPercent: -100, duration: 0.85, ease: 'expo.inOut' }, '-=0.25')
        .add(resolve, '-=0.6');
    });
  });
}

function heroIntro() {
  gsap.timeline({ defaults: { ease: 'expo.out' } })
    .fromTo(heroLetters, { scaleY: 0 }, { scaleY: 1, duration: 1.1, stagger: (i) => DRIP[i] * 0.07, ease: 'back.out(1.6)' }, 0)
    .from('.hero__cover', { clipPath: 'inset(100% 0% 0% 0% round 14px)', duration: 1.3, ease: 'expo.inOut' }, 0.05)
    .from('.hero__cover img', { scale: 1.4, duration: 1.6 }, 0.05)
    .to('.hero__cover .scan-color', { clipPath: 'inset(0 0% 0 0)', duration: 1.4, ease: 'power2.inOut' }, 0.9)
    .from('.hero__box', { x: -60, rotate: -4, opacity: 0, duration: 1.1 }, 0.25)
    .from('.hero__date', { x: 60, rotate: 4, opacity: 0, duration: 1.1 }, 0.3)
    .from('.sticker', { scale: 0, rotate: -30, duration: 0.8, ease: 'back.out(3)' }, 0.8)
    .from('.seal', { scale: 0, rotate: -180, duration: 1.3 }, 0.5)
    .from('.piano__hint', { opacity: 0, y: 10, duration: 0.8 }, 0.6)
    .from('.piano .key:not(.key--black)', { yPercent: 100, duration: 0.9, stagger: { each: 0.02, from: 'center' } }, 0.5)
    .from('.piano .key--black', { yPercent: -100, duration: 0.7, stagger: { each: 0.025, from: 'center' } }, 0.75)
    .add(() => strings.glissando(90), 0.3);
}

/* =================================================================
   Round 3: the strings thread, velocity physics, seams, 2nd horizontal
   ================================================================= */
const STRING_COLORS = ['#ff4f9a', '#ffc21a', '#2fbf71', '#2ea8ff', '#8f6bff'];
let scrollVel = 0;

function buildStaffSeams() {
  const NS = 'http://www.w3.org/2000/svg';
  const POINTS = 48;
  return $$('[data-staff]').map((seam, si) => {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1000 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    const paths = STRING_COLORS.map((c, i) => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('stroke', c);
      p.setAttribute('pathLength', '1');
      p.style.strokeDasharray = '1';
      p.style.strokeDashoffset = reduced ? '0' : '1';
      svg.appendChild(p);
      return p;
    });
    seam.appendChild(svg);
    const state = { amp: 4, phase: si * 1.7, visible: false };
    const draw = () => {
      paths.forEach((p, i) => {
        const y0 = 18 + i * 16;
        let d = '';
        for (let k = 0; k <= POINTS; k++) {
          const t = k / POINTS;
          const env = Math.sin(t * Math.PI);
          const y = y0 + Math.sin(t * 9 + state.phase + i * 0.8) * state.amp * env;
          d += `${k ? 'L' : 'M'}${(t * 1000).toFixed(1)},${y.toFixed(2)}`;
        }
        p.setAttribute('d', d);
      });
    };
    draw();
    if (!reduced) {
      new IntersectionObserver(([e]) => (state.visible = e.isIntersecting)).observe(seam);
      gsap.to(paths, { strokeDashoffset: 0, ease: 'none', stagger: 0.08,
        scrollTrigger: { trigger: seam, start: 'top 95%', end: 'top 35%', scrub: true } });
    }
    return { state, draw };
  });
}

function buildRound3(hTween) {
  const seams = buildStaffSeams();

  // shared scroll velocity
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => { scrollVel = self.getVelocity(); } });

  // velocity-reactive skew on cards, programme rows and the standard lines
  const skewers = [
    ...$$('.voice').map((el) => ({ fn: gsap.quickTo(el, 'skewX', { duration: 0.5, ease: 'power3' }), k: -1 / 260, max: 7 })),
    ...$$('.prog').map((el) => ({ fn: gsap.quickTo(el, 'skewX', { duration: 0.6, ease: 'power3' }), k: -1 / 300, max: 8 })),
    ...$$('.standard__line').map((el) => ({ fn: gsap.quickTo(el, 'skewX', { duration: 0.6, ease: 'power3' }), k: 1 / 200, max: 12 })),
    ...$$('.snap').map((el) => ({ fn: gsap.quickTo(el, 'skewY', { duration: 0.6, ease: 'power3' }), k: -1 / 400, max: 4 })),
  ];
  let t = 0;
  gsap.ticker.add((_, delta) => {
    t += delta / 1000;
    const v = scrollVel;
    skewers.forEach((s) => s.fn(gsap.utils.clamp(-s.max, s.max, v * s.k)));
    // strings in the seams vibrate with scroll speed
    seams.forEach((s) => {
      if (!s.state.visible) return;
      s.state.amp += (Math.min(30, 4 + Math.abs(v) / 90) - s.state.amp) * 0.12;
      s.state.phase += 0.03 + Math.abs(v) / 40000;
      s.draw();
    });
    // the hero strings shiver with scroll speed too
    if (Math.abs(v) > 300 && window.scrollY < window.innerHeight * 1.2) {
      const i = Math.floor(Math.random() * strings.count);
      strings.pluck(i, Math.random(), gsap.utils.clamp(-4, 4, v / 900));
    }
    scrollVel *= 0.9;
  });

  // seam transitions: chapters open like curtains as they arrive
  gsap.fromTo('.voices', { clipPath: 'inset(5% 4% 0% 4% round 48px 48px 0px 0px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px 0px 0px 0px)', ease: 'none',
    scrollTrigger: { trigger: '.voices', start: 'top bottom', end: 'top 8%', scrub: true } });
  gsap.fromTo('.room', { clipPath: 'inset(6% 5% 0% 5% round 56px 56px 0px 0px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px 0px 0px 0px)', ease: 'none',
    scrollTrigger: { trigger: '.room', start: 'top bottom', end: 'top 8%', scrub: true } });
  gsap.fromTo('.method', { clipPath: 'polygon(0% 8%, 100% 0%, 100% 100%, 0% 100%)' }, { clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)', ease: 'none',
    scrollTrigger: { trigger: '.method', start: 'top bottom', end: 'top 30%', scrub: true } });

  // Practice → Recital: the last snapshot is pulled toward the stage as the room leaves
  gsap.to('.room__wall', { scale: 1.12, yPercent: -6, rotation: -2, ease: 'none',
    scrollTrigger: { trigger: '.recital', start: 'top bottom', end: 'top top', scrub: true } });

  // a second horizontal set piece: the standard band pins and slides
  // pin the whole chapter so the exam cards share the screen with the sliding names
  gsap.timeline({ scrollTrigger: { trigger: '.standard', start: 'top top', end: () => (window.innerWidth < 700 ? '+=40%' : '+=70%'), pin: true, scrub: 0.6, invalidateOnRefresh: true } })
    .fromTo('.standard__line[data-dir="-1"]', { xPercent: 0 }, { xPercent: -45, ease: 'none' }, 0)
    .fromTo('.standard__line[data-dir="1"]', { xPercent: -45 }, { xPercent: 0, ease: 'none' }, 0)
    .fromTo('.standard__line .o', { rotate: 0 }, { rotate: 360, ease: 'none' }, 0);

  ScrollTrigger.sort();
  ScrollTrigger.refresh();
}

/* Book-this-class: pre-select the instrument and jump to the form */
$$('[data-book]').forEach((btn) => btn.addEventListener('click', () => {
  const radio = form.querySelector(`input[name="instrument"][value="${btn.dataset.book}"]`);
  if (radio) { radio.checked = true; radio.dispatchEvent(new Event('input', { bubbles: true })); }
  const target = $('.enquiry');
  if (lenis) lenis.scrollTo(target, { offset: -90, duration: 1.8 });
  else target.scrollIntoView();
  chime(4, 0.4);
  setTimeout(() => { nameInput.focus({ preventScroll: true }); if (!reduced) gsap.fromTo(target, { rotate: -1.5, scale: 0.98 }, { rotate: 0, scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.4)' }); }, lenis ? 1700 : 50);
}));
