# Tests

All suites run from a plain checkout of this repo. CI runs the same script on every push and pull request
(`.github/workflows/test.yml`).

```sh
pip install playwright        # Python Playwright drives an installed Chrome
sh test/run_all.sh            # serves the checkout at http://127.0.0.1:8810/bake-k7q2/ and runs everything
```

Set `CHROME=/path/to/chrome` if Chrome is not at `/usr/bin/google-chrome`.

| Suite | Command | What it covers |
|---|---|---|
| Unit (core.js) | `TZ=Asia/Qatar node test/unit.js` and `TZ=Europe/London node test/unit.js` | Scaling consistency, planner sweep (21,312 plans), unavailable-window edges, alternatives, interpolation, DDT. London adds the clock-change days. |
| Pizza session | `TZ=Asia/Qatar node test/pizza_session.js` (and London) | The whole pizza session (every ball, 3 min each) is checked against the unavailable window, including the 23 °C / 28 h case from issue #1, with negative controls. |
| End to end | `python3 test/v21.py <url>` | Every screen at 3 sizes, light and dark, planner, timer, readiness checks, storage, export and import. Screenshots go to `shots/` (gitignored). |
| Accessibility | `sh test/fetch_axe.sh && python3 test/audit21.py <url>` | axe-core 4.10.3 (serious or critical fails) and 44 × 44 px targets. |
| Offline | `python3 test/offline.py <url>` | Service worker install, versioned cache, offline reload. |
| Smoke | `python3 test/smoke.py <url>` | Walks every screen and fails on any console error. |

Every suite exits non-zero on failure.
