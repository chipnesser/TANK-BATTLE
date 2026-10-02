# Repair and validation — October 2, 2026

## Source and architecture

Repaired the actual `chipnesser/TANK-BATTLE` repository starting from
`ecf8d73a7b8a9597d44ddc15ca744792903663e4`. Work is in the local branch
`codex/restore-controls-and-theaters`. No replacement game was created.

The original project uses two identical HTML entry points, a canvas perspective
renderer, one `world` state, a requestAnimationFrame update loop, keyboard and
pointer handlers, synthesized sound, four encounters and a bonus/chess ending.
The repair leaves that engine in place. Optional sensor handling and reusable
level data are the two extracted JavaScript files.

## Repository history

| Commit | Relevant change |
| --- | --- |
| `77db2b5` / `da41fad` | Last code before motion work; `da41fad` added the alternate HTML entry |
| `a41276d` | First gamma-based gyro steering, replacing joystick turn input; also unrelated ending/mobile changes |
| `ddba78c` | Beta throttle, calibration, smoothing, 20% manual-input blend, new mobile camera |
| `c2a6a8c` | Permission button and sensor enable/disable helpers; chess improvements |
| `46056e3` | Changed throttle sign from neutral-minus-beta to beta-minus-neutral |
| `ecf8d73` | Current upstream: gyro hint, pickups, touch restart; existing motion defects remained |

The newer local exported HTML has a mandatory gyro mission-intro gate. That gate
is **not** in upstream `ecf8d73`; it was not carried into this repair. Reverting
the entire repository to a pre-motion commit would also discard unrelated
features. Instead, normal input was restored first and then the sensor adapter
was added separately.

## Failures traced and repaired

1. **Calibration happened before any sensor event.** Enabling recorded initial
   zeros as neutral. A reproduced upstream test supplied a comfortable steady
   pose (`beta=60`, `gamma=25`) after enable: neutral stayed zero, beta was clipped
   to 50, both axes became 1, and the tank moved 182 world units in a one-second
   update despite no manual input. The new adapter centers the first valid sample.
2. **Landscape axes were never remapped.** Beta/gamma were always interpreted in
   device coordinates. The adapter projects gravity into visible screen axes;
   both landscape directions, upside-down portrait and legacy Safari orientation
   are tested. Rotation waits for a new neutral sample.
3. **Clipping preceded calibration.** Original beta/gamma limits discarded a
   comfortable holding angle. Full valid readings now determine neutral; only
   final normalized control output is limited, with smoothing and dead zones.
4. **Gyro weakened manual controls.** The original enabled path multiplied
   keyboard/joystick input by 0.2 and mixed it with sensor drift. Direct input now
   overrides motion at full strength. Keyboard always works; a held joystick
   overrides both motion axes.
5. **No sensor health or denial feedback.** API presence was mistaken for a
   working sensor. Missing/invalid events, denied/rejected permissions, insecure
   contexts and sensor loss now yield neutral motion without gating gameplay.
   Start timeout is 3.5 seconds; stale readings stop motion after 1.5 seconds.
   Listener/timer cleanup also covers disable, reset, pause and focus loss.
6. **Inherited input defects amplified the regression.** Width below 900 pixels
   selected touch-only movement even on desktop. This defect also reproduces in
   pre-gyro code, so it is not attributed to the gyro commits. Keyboard now works
   at every size. The joystick's assumed center differed from its visual center;
   it now measures its base. The gyro-era global touchend cancellation also
   suppressed rapid button taps; CSS handles zoom prevention instead.

Also repaired held input after focus/pointer loss, canceled charge accidentally
firing, key handling while entering the final name, stale pickups after restart,
pause deadlines expiring and pending projectile impacts lost after a slow frame.
Mouse click/hold firing uses the existing charge/weapon behavior.

## Preserved behavior and restrained polish

W/S, Up/Down, A/D, turret arrows, Space tap/hold, R and P remain. Touch autoaim,
five-round magazine, five health, regeneration/invulnerability, normal/mega/rocket
bonus behavior, enemy types, scoring, boss stats, cumulative 15/30/45/60 kill
targets, 75-second bonus round, music and chess ending remain.

Polish adds subtle suspension/tread movement, vehicle shadows and highlights,
recoil/muzzle flashes, brief surviving-hit rings and explosion shock rings. It
aligns the cannon muzzle with its stem, improves button/focus/overlay states,
separates HUD buttons and text, moves the landscape radar above the joystick,
and fixes the portrait rotation hint overlap. No image assets, new graphics
library, postprocessing, unbounded particle emitter or runtime dependency was added.

Theater data adds distinct palettes, silhouettes, terrain placement and a few
player movement barriers while retaining encounter combat balance. See
[theater documentation](theaters.md) for future extensions and obstacle limits.

## Validation

- 23 focused tests: permissions, secure-context/API fallback, fresh-sample
  calibration, dead zones, axes, rotation, stale readings, cleanup, delayed
  permission resolution and campaign compilation/extension/isolation.
- 17 Chromium browser checks: desktop 1280/800 pixels, tablet 1024×768/768×1024,
  phone 390×844/844×390, actual pointer capture and touch taps, keyboard fallback,
  fire/charge/reload/pause, simulated sensor permissions/packets, missing motion
  script, combat/pickups, every encounter/boss, bonus/ending, water/barriers,
  pause timers and both HTML entry points. These check for uncaught page errors.
- Browser screenshots reviewed for desktop, portrait/landscape mobile and every
  theater. Screenshots live in ignored `test-results/`.
- A lightweight same-scene render-submission benchmark (1280×720, four enemies,
  explosion/debris, 200 terrain marks) measured median 0.044 ms upstream versus
  0.047 ms repaired on this machine. This measures canvas command submission,
  not GPU completion, sustained FPS, battery consumption or iPad performance.
- `git diff --check` and JavaScript syntax checks.

Browser tests use installed Chrome through Playwright 1.62.1 in a temporary
profile; they do not operate the user's signed-in Chrome profile.

## Remaining limits

No physical iPad or Safari runtime was available. Native permission gestures,
tilt comfort/sign/sensitivity, Safari multitouch behavior and real device frame
rate must still be checked on iPad over HTTPS. Emulation and injected sensor
events are useful regression coverage, not hardware certification.

New terrain barriers affect player movement only; enemy pathfinding and shell
cover are unchanged. They are deliberately few and small. The original HTML
engine is still substantial; this is a targeted repair and data extraction.

Publication uses the existing GitHub Pages configuration: `main`, repository
root, at https://chipnesser.github.io/TANK-BATTLE/. Both external JavaScript
files must be published beside the HTML. The old ZIP remains historical.
