# v2.1 reliability release (23 Oct 2026)

v2.1 fixes the problems the independent critique of v2 found. It adds no new features beyond what those fixes needed. The rule for this section: **an item is only "Fixed" if a test proves it**, and each one names its tests. The recipe ratios are unchanged.

Test runs on the final build:

| suite | result |
|---|---|
| `test/unit.js` (Node; run under `TZ=Asia/Qatar` and `TZ=Europe/London`) | **68,130 passed, 0 failed** in each time zone |
| `test/v21.py` (Playwright/Chromium: 3 viewports × light/dark, planner, timer, storage, import/export, formula on screen) | **182 passed, 0 failed** |
| `test/audit21.py` (axe-core serious/critical + every visible control ≥44×44 on 20 screens and sheets, light + dark) | **88 passed, 0 failed** |
| `test/offline.py` (service worker installs, cache named after the build version, reload offline, maths + planner work) | **6 passed, 0 failed** |
| `test/smoke.py` | 0 console errors |

The unit suite covers:
- **Formulas:** 120 recipe/scale/option combinations and 3,840 gram figures extracted from the method, planner and timer text.
- **Planner sweep:** 21,312 plans (4 recipes × 9 kitchen temperatures × every fridge option × a "now" every 15 minutes, plus "start at" mode). Each plan is checked by an independent minute-by-minute walk.

| # | Critique item | Status | Proven by |
|---|---|---|---|
| P0-1 | Planner could put hands-on or oven work inside the night (only step *starts* were checked). | **Fixed.** Intervals are checked. Every prep and oven step is checked for its whole duration, and wait steps that begin with work count their hands-on start (levain 15 min, sandwich starter + tangzhong 20 min). The unavailable window is configurable (default 23:00–06:00) and saved. If nothing fits, the app says **"No plan fits your unavailable hours"**, lists and highlights the clashes, and offers only verified-compliant alternatives: a later or earlier time, another day, or another fridge option within the recipe's range. You can also keep the plan explicitly ("Keep this plan anyway"); that acceptance is tied to the exact plan and dropped when the plan changes. Fermentation times are never shortened to make a plan fit. | unit: `planner sweep: *` (19,872 compliant plans with 0 minutes inside the window by the independent walk; 1,440 explicit no-compliant results), `edges: *` (23:00/06:00 boundaries to the minute, across midnight, a non-wrapping window, window off, from = to), `alternatives: every offered alternative complies`, `no-plan: *`, `dst: *`. v21: `planner: pizza at 23 °C with a 28 h fridge stage shows the explicit no-compliant-plan state`, `…lists the clashing steps`, `…acceptance is tied to this exact plan`, `…a hand-picked 03:00 loaf is flagged, never silently moved`, `planner: unavailable hours are saved and restored` |
| P0-2 | Method text, levain lines and timer text didn't follow scaling. The large-tray focaccia levain didn't match. | **Fixed.** One `calc()` per recipe in `src/core.js` feeds the table, method, levain build, planner details and timer text. The 30×40 focaccia uses the booklet's 25 + 75 + 75 build. | unit: `scaling: every gram figure in method/planner/timer text is a computed value` (3,240 checks), `scaling: levain build line identical in table, method and planner`, `scaling: table rows sum to the total`, `scaling: 30×40 focaccia uses the booklet 25 + 75 + 75 build`. v21: `focaccia: 30×40 tray uses the booklet 25 + 75 + 75 build on screen`, `scaling: …and the method says the same` |
| P1-3 | The sandwich warm-kitchen variant was inconsistent between screens. | **Fixed.** Standard (15 g seed), warm kitchen (8 g seed) and chill (adds a fridge stage for the starter) are picked on the recipe and used everywhere. | unit: `scaling: sandwich starter = (15\|8 seed) …`, `variant: chill adds a fridge stage…`. v21: `variant: warm shows an 8 g starter in the table / method / planner`, `variant: chill adds the fridge stage in the planner / timer` |
| P1-4 | The wake lock wasn't restored; the timer auto-advanced after fermentation steps. | **Fixed (with stated limits).** The wake lock is re-requested on start, restore and visibility changes, and after a system release. The button shows the real state (held, released or refused). Fermentation and proof steps end in **"Is it ready?"** with +15/+30/+60, "Ready: start …" and "Unsure: how to judge it" (a guide sheet). Nothing starts by itself. Hands-on steps end with "Start next". The readiness box keeps saying when the timer ended, including "while the app was closed". A tip recommends a backup Clock alarm and shows the end time. **Not done:** Web Push (out of scope; it needs a server). | v21: `wake lock: *` (7 tests with a mocked Wake Lock API, including restore on reload and a refused lock), `timer: nothing auto-starts after a fermentation step`, `timer: readiness offers +15/+30/+60, Ready and Unsure`, `timer: reload while running / paused`, `timer: reload after a step ended while closed shows the readiness check`, `midnight: *`, `clock change: *` |
| P1-5 | No distinction between "out of the oven" and "ready to slice". | **Fixed.** The planner target is "Out of the oven" or "Ready to slice/cut" (pizza: "First pizza in" or "All pizzas done"), and both marks are on the timeline. | v21: `planner: 'Ready to slice 12:00' starts 2½ h (cooling) earlier than 'Out of the oven 12:00'`, `planner: timeline shows both … marks`, `planner: pizza targets are 'First pizza in' / 'All pizzas done'` |
| P1-6 | A pizza mass constant: balls × weight ≠ total. | **Fixed.** Flour is derived from balls × ball weight ÷ the formula sum, so the total matches within 1 g for every size. **Flag for Michael:** the default ball weight is now **276.5 g** (the booklet's 1,106 g ÷ 4; the booklet prints 276 g). A saved 276 is migrated to 276.5. The flours are still 360 g + 240 g. | unit: `mass: pizza balls × ball weight = total dough (±1 g)` (48 cases), `mass: default pizza flours are the booklet 360 g + 240 g`, `mass: loaf weight mode total = requested weight (±1 g)`. v21: `pizza: ball weight shows 276.5 g and the total is 1,106 g` |
| P1-7 | Touch targets under 44 px (the v2 claim was false). Sheets weren't real dialogs. | **Fixed.** The base CSS was corrected: icon buttons 44×44, segments min-height 44, steppers 46×44, small timer buttons min-height 44. The sheets have `role=dialog`, `aria-modal`, `aria-labelledby`, a focus trap, Escape to close, an inert background and focus return. The re-audit also found the kitchen thermometer badge's white label failing contrast at 23 °C. The 26 °C and 28 °C colours also computed below 4.5:1, so all five were darkened and the audit now covers 25, 26, 28 and 30 °C. | audit21: `targets {light,dark} *: every visible control >= 44x44` (20 screens and sheets × 2 schemes), `a11y *: no serious/critical axe violations`, `* sheet (dialog): role=dialog + aria-modal + label`. v21: `sheet: *` (focus in, inert, Tab/Shift+Tab trapped, Escape, focus return) |
| P2-8 | Temperature guidance was step-wise. There was no DDT. | **Fixed.** Interpolation is continuous between the booklet's bands (23–29 °C, clamped outside), and times are shown as windows ("≈ X–Y"). The DDT calculator gives water = 4 × target − kitchen − flour − levain − friction, with friction labelled "needs calibrating". A measured dough temperature entered in the timer is stored in the session and drives the bulk estimate. | unit: `temp: *` (continuity, monotonic, booklet values at the reference temperatures, windows), `ddt: *`, `temp: measured dough temp changes the bulk step only`. v21: `ddt: *`, `timer: entering 28 °C dough shortens the bulk estimate`, `timer: measured dough temp is stored in the session` |
| P2-9 | Storage: a reset in one tab could be undone by another, and stale sessions were written back. | **Fixed.** Stored state carries an epoch and a revision. A tab adopts newer or other-epoch data instead of overwriting it, and storage cleared elsewhere resets this tab without writing back. | v21: `tabs: *` (7 tests with two real tabs), `storage: *` |
| P2-10 | No export/import. | **Fixed.** A documented JSON format (`DATA.md`) is validated and sanitised, and a preview is shown before anything is replaced. | v21: `export: *`, `import: *` (preview, foreign file refused, clamping, bad JSON and unknown version rejected) |
| — | Layout and console at 390×844, 375×667 and 430×932, light and dark. | **Fixed.** | v21: `layout: no sideways overflow at …` and `console: no errors or warnings at …` (all 6 combinations). The only filtered console message is Playwright's own notice that it blocked the service worker in test contexts. |

## Known limits and open items (honest list)

- **Flag: sandwich "chill" variant fridge stage = 480 min (8 h).** This is an assumption, not from the booklet. The step text says 8–12 h, but the planner schedules a fixed 8 h. At ≥27.5 °C, combined with the dough's own fixed stages, this leaves some cases with no compliant plan. The app reports them as no-compliant rather than stretching the time. Michael should confirm or give the real duration.
- **Flag: pizza ball weight 276.5 g** (above). It changes the displayed default from 276 g. The dough formula is unchanged.
- **The genuine no-compliant cases** (1,440 of 21,312 in the sweep) are mainly pizza with the 28 h fridge stage at ≤24.5 °C, where the mix and the bake can't both avoid 23:00–06:00, and the sandwich chill variant at ≥27.5 °C. These are correct outcomes, not bugs. The app offers the other fridge options instead.
- **Web Push / lock-screen alerts:** not implemented (needs a push server). The app recommends a backup Clock alarm instead.
- **Setting the device clock back** while a step runs makes the step run longer. The timer is wall-clock based, which is what keeps it correct across reloads and closed apps. Tested to stay finite and running, not to compensate.
- **Whole-gram display:** quantities ≥10 g are shown rounded to whole grams (e.g. 22.5 g → 23 g) on every screen alike. The unit tests check that all screens show the same figure.
- **Real-device checks** (iOS Safari Wake Lock behaviour, audio when locked) were not run. All tests use Chromium with a mocked Wake Lock API.
- **The older v2 Playwright scripts** assert v2 copy and were not rerun. They are not in the repo; `test/v21.py` supersedes them.
- **Next (v3):** a bake journal and a starter-health log, deliberately left out of this reliability release.

# Michael's Baking: critical review (v2)

Reviewed on 23 Oct 2026 from three angles: a demanding product designer, an iPhone user and an experienced home baker. Each finding is ranked by severity and has a status:

- **Fixed**: changed in this release.
- **Mitigated**: the platform can't do it, so the app handles it gracefully and says so.
- **Open**: not changed, with the reason.

The recipe ratios were not changed.

## High

| # | Finding | Status |
|---|---|---|
| H1 | **No real offline support.** The manifest was a runtime data-URI, there was no service worker and the icons were data-URIs. On iOS, "Add to Home Screen" gave a shortcut that would not load without signal. | **Fixed.** Added a real `manifest.webmanifest`, PNG icons (192, 512, maskable 512, 180 apple-touch) and `sw.js`. The service worker precaches every file, serves cache-first and names its cache after a build hash, so old caches are deleted on activate. A "New version ready · Reload" banner appears when an update takes over. All paths are relative, so it works under `/bake-k7q2/`. Tested: install, go offline, reload, and the app renders with working maths. |
| H2 | **The planner could open on a start time that had already passed** (default "ready at" on today's date), or on starts in the middle of the night. | **Fixed.** Each recipe has its own day. The default is the earliest day the plan is achievable, with the ready time as close as possible to a sensible daytime target: loaf 09:00, focaccia 13:05, pizza 16:30, sandwich 10:15, each with an allowed window. Plans whose start or any step start falls between 23:00 and 06:00 are avoided where possible. A plan you set yourself is kept, but if it has gone stale it is moved forward with a toast. Verified at 16:00 today: loaf starts 06:10 tomorrow and is ready Sun 09:15, with no step starting at night. |
| H3 | **iOS alerts.** Web apps can't vibrate on iPhone, can't play sound while the screen is locked or the app is in the background, and need a tap before audio plays again after a reload. | **Mitigated.** Audio unlocks on the first touch anywhere. Wake Lock ("Screen stays on") is now on by default. The timer shows an *Alerts* note on iPhone telling you to keep the screen open, turn the silent switch off and set Auto-Lock if Wake Lock isn't available. If a step finishes while the app is closed, the next launch shows "Step N finished at HH:MM while the app was closed". On Android and desktop, an optional *Alerts* button adds system notifications through the service worker. |
| H4 | **Colour contrast failures** (WCAG AA) in secondary text, chips, estimate badges, dark-mode buttons, selected day pills and the starter build total. | **Fixed.** Retuned `--ink3`, added `--olive-ink` and `--heat-ink`, darkened the dark-mode primary button and removed opacity on labels. axe-core now reports 0 contrast violations on 8 views in light and dark. |
| H5 | **`user-scalable=no`** blocked pinch-zoom, an accessibility failure. | **Fixed.** Removed. Inputs are ≥16 px, so iOS doesn't auto-zoom on focus. |
| H6 | **iOS status bar** used `black-translucent`, which puts white status text over the cream background in the home-screen app. | **Fixed.** Now `default`, and the theme colour matches the background. |

## Medium

| # | Finding | Status |
|---|---|---|
| M1 | Tap targets under 44 px: segmented controls, steppers, back and icon buttons, timer small buttons, sliders and chips. | **Claimed fixed in v2, but that claim was wrong.** The base CSS still had icon buttons at 40×40, steppers at 44×40 and segments at min-height 38 (only some overrides were 44). The v2 audit missed them. Fixed for real in v2.1; see below. |
| M2 | Every stepper was announced as "decrease" or "increase", with no context. | **Fixed.** Each stepper has a specific label (e.g. "Kitchen temperature: decrease"), groups have `role=group`, toggles use `aria-pressed` and the tab bar uses `aria-current`. |
| M3 | Dough weight (±50 g), ball weight and tray size could only be changed one tap at a time, which is tedious for 2–3 kg. | **Fixed.** You can type the value (numeric keypad) and it is clamped to a safe range with a toast. Press and hold repeats, accelerating after 12 steps. |
| M4 | The loaves label said "1,415 g each" even when the loaf mode was scaled. | **Fixed.** It is now calculated. |
| M5 | Multiple tabs: a change in one tab replaced the screen in the other, could ping-pong saves forever, and both tabs chimed. | **Fixed.** Each tab keeps its own screen and only the data syncs. Remote updates are not echoed back. A step-done event checks storage, so only one tab rings. |
| M6 | Stored values were trusted, so corrupt or old localStorage could give NaN or negative maths. | **Fixed.** `sanitize()` migrates v1 to v2, clamps every number and validates modes, tins, trays, days and the timer session. 0, negative and huge typed values clamp (e.g. −5 → 300 g, 99999 → 12,000 g, tray 0 → 10 cm). |
| M7 | The Android back button left the app instead of closing the recipe. | **Fixed.** Opening a recipe pushes a history entry. Back closes a sheet or the recipe. |
| M8 | The timer's "ends HH:MM" had no day, which is confusing for overnight fridge steps. | **Fixed.** It reads "ends 08:15 tomorrow" or shows the weekday. |
| M9 | Temperatures outside the tables (below 18 °C or above 32 °C) gave no warning. | **Fixed.** A note explains that timings are extrapolated and the dough should be watched. |
| M10 | The "now baking" pill was a `div` with no keyboard access. | **Fixed.** It is a `<button>` with a descriptive label. |
| M11 | Keyboard users had no visible focus. | **Fixed.** Added `:focus-visible` outlines. |
| M12 | The timer view kept the scroll position of the step list, so on small phones the countdown opened half off-screen after starting a step. | **Fixed.** Found during the v2 re-test at 375×667; it now scrolls to the top. |
| M13 | The temperature control overflowed the card on 375-px-wide phones. | **Fixed.** Found during the re-test; controls now wrap. |

## Low

| # | Finding | Status |
|---|---|---|
| L1 | "What I improved" copy (first person, odd in an app). | **Fixed.** Now "What's improved". |
| L2 | "Warm kitchen" label shown at any temperature. | **Fixed.** Now "Your kitchen · X °C". |
| L3 | The planner's start button implied the timer follows the planned clock time. | **Fixed.** Renamed "Open the bake-day timer", with a note that the timer starts when you press it. |
| L4 | The bottom sheet used `86vh`, which jumps with the iOS toolbar. | **Fixed.** Now `86dvh`. Safe-area padding was added for landscape and notch sides. |
| L5 | Pizza base dough is 1,104 g in the formula, but the booklet shows 1,106 g (rounding of its gram lines). | **Open, by design.** The 0.17 % difference keeps every booklet gram figure identical (276 g per ball, 1,106 g total). |
| L6 | The sandwich loaf shows a fixed "≈62 %" effective hydration (milk, honey and oil are counted by convention). | **Open.** It is a convention, not a calculation error. Changing it would mean reinterpreting his recipe. |
| L7 | Switching planner mode from "start at" to "ready by" carries a non-round ready time (e.g. 09:12). | **Open.** Deliberate: switching mode keeps the same bake rather than jumping. ±15 snaps it. |
| L8 | The time picker shows 12 h or 24 h depending on the phone's locale. | **Open.** This is the native control and follows the iOS setting. |
| L9 | Toasts were too short for long messages. | **Fixed.** Duration scales with message length. |

## Calculations re-checked against the booklet (v2 build)

- Loaf: 750 / 470 / 30 / 150 / 15 = 1,415 g, 69.7 % hydration. ×2 = 2,830 g. Typed 1,000 g scales proportionally.
- Focaccia: 500 / 360 / 30 / 100 / 11 / 20 = 1,021 g, 80.0 %. The 30×40 tray gives 790 / 569 / 47 / 158 (the booklet rounds to 570 / 160).
- Pizza: 360 / 240 / 350 / 30 / 110 / 16 = 1,106 g, 276 g per ball, 66.4 %. 6 balls at 68 % = 1,659 g at 68.0 %.
- Sandwich: 1,242 g with 670 g flour. A 2 lb tin is ×0.75 = 932 g.
- The timer survives a reload; the countdown is timestamp-based, so it is correct across midnight and while the app was closed.

## iOS Safari notes

- No `100vh` anywhere. The app shell is `position:fixed; inset:0`, so the iOS toolbar can't make it jump. `env(safe-area-inset-*)` covers the notch, the home bar and landscape sides.
- Vibration: not available on iOS. The UI says so; `navigator.vibrate` is feature-detected and never called there.
- Wake Lock: used on iOS 16.4+ when available; otherwise the note asks you to set Auto-Lock.
- Web Push on iOS only works for an installed app with a push server. That isn't used here, so the Alerts button is hidden on iPhone.

## Performance and console

- About 219 KB single HTML file (fonts inlined), plus about 75 KB of icons. Everything is precached, so it opens instantly offline.
- Playwright click-through at 390×844, 375×667 and 430×932: 0 console errors and 0 warnings.
