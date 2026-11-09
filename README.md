# The ARK Music Shillong — website

Motion-led, story-driven site for The ARK Music Shillong, a music school in Shillong, Meghalaya (est. 3 Dec 2022): Western & Hindustani vocal, piano & keyboard, guitar and violin.

**Stack:** Vite · GSAP (ScrollTrigger, SplitText) · Lenis smooth scroll · Canvas 2D (hero strings) · Web Audio (playable piano).

**Motion reference:** principles adapted from the Awwwards nominee Kelvin Music Festival 2027 — letter melt/rise across section seams, a dealt photo pile, a horizontal track with a centre playhead colour scan, a light-band sweep and a shape that grows across a seam. No code, copy or assets were reused.

**Media:** all photographs come from The ARK's own Instagram (@thearkmusic_shillong_2023). Icons: Solar + Simple Icons via Iconify.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build   # outputs dist/
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

A **Motion: full / calm** toggle in the nav respects `prefers-reduced-motion` by default and remembers the visitor's choice.
