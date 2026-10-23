# Contributing to Michael's Baking

This repo works the same way as Michael's Recipes, Everyday Plate and Strong Stride. The shared channel is the
[kickoff issue #1](https://github.com/MichaelSP129/bake-k7q2/issues/1). Read it first.

## Roles
- **ChatGPT** (reviewer): code review; the correctness of calculations, scaling and the planner (interval-based scheduling, unavailable hours, midnight edge cases); timer and persistence behaviour; offline/service-worker updates; food safety.
- **Claude** (reviewer): baking-science accuracy (fermentation timing vs temperature, DDT/water temperature, levain inoculation, readiness cues); recipe content and its consistency across screens; mobile UX and accessibility; copy.
- **Baking bot** (developer): works on `baking/<topic>` branches, opens PRs into `main`, responds to reviews and sweeps issues around 9:00 AM and 6:00 PM Qatar time.
- **Michael**: the only one who merges and publishes.

Reviewers check about 9:30 AM and 6:30 PM Qatar time (06:30 and 15:30 UTC) and stay quiet when nothing is new.
Every comment starts with its author's prefix: **[ChatGPT]**, **[Claude]**, **[Baking bot]**.

## Rules
1. Never push to `main`.
2. One finding per issue: severity (P0–P2), evidence/repro, acceptance criteria.
3. One topic per PR, referencing its issue with `Fixes #N`, saying what changed, why and how it was tested.
4. Don't change the quantities or methods of Michael's recipes without flagging it for his approval.
5. Never weaken food-safety guidance.
6. Only Baking bot's PRs bump the cache version in `sw.js` (the build derives it from a content hash, so rebuilding is what bumps it).
7. Don't claim something is fixed without a test that proves it.

## Layout
- `index.html`, `sw.js`, `manifest.webmanifest`, `icons/`: the built app that GitHub Pages serves. Don't hand-edit these.
- `src/`: the source. `core.js` holds the pure logic (formulas, scaling, the planner and temperature interpolation, with no DOM). `data.js` holds the recipe content, `app.js` the UI, plus `app.css`, `shell.html` and `build.py`.
- `test/`: the tests (see below).
- `REVIEW.md`: the critique items and their status. `DATA.md`: the export/import file format.

## Building and running locally
```
python3 src/build.py            # writes index.html, sw.js (new cache version), manifest, icons
python3 -m http.server 8000     # then open http://localhost:8000/
```

## Tests
- `node test/unit.js`: formula consistency, mass, variants, interpolation, DDT, and the planner sweep with its edge cases. It is pure Node with no dependencies and takes about 3 minutes. Run it under two time zones, e.g. `TZ=Asia/Qatar` and `TZ=Europe/London`.
- `python3 test/v21.py`, `test/audit21.py`, `test/offline.py` and `test/smoke.py`: Playwright (Chromium). They expect the app to be served at `http://127.0.0.1:8801/bake-k7q2/`; pass another URL as the first argument (`v21.py`, `audit21.py`, `offline.py`) if you serve it elsewhere. `audit21.py` needs `test/vendor/axe.min.js` (axe-core 4.x, not committed).
