# Desert Tank Patrol

The original browser arcade tank game, repaired in place. Its four encounters,
weapons, enemy/boss balance, scoring, soundtrack, bonus round and chess ending
remain intact. The existing desert palette and vehicle silhouettes are retained.

## Files

- `index.html` — the existing game engine, UI and canvas rendering
- `tank-game.html` — identical alternate entry point, retained for existing links
- `motion-controls.js` — optional, isolated sensor adapter
- `theaters.js` — reusable environments and the original campaign encounters
- `tests/` — motion, campaign and browser regression checks
- [Repair notes](docs/repair-notes.md) — history, reproduced failures and validation
- [Adding theaters](docs/theaters.md) — data structure and extension examples

## Play online

https://chipnesser.github.io/TANK-BATTLE/

## Run locally

Open `index.html` in a browser, keeping both JavaScript files beside it. No build
or runtime dependencies are needed. Alternatively, run `python3 -m http.server
8777 --bind 127.0.0.1` in this folder and open `http://127.0.0.1:8777`.

Keyboard works at every window size, including on a tablet with a keyboard:
W/S or Up/Down move; A/D turn; Left/Right aim the turret; tap/hold Space fires
or charges; R reloads; P pauses. Mouse click/hold on the battlefield also fires
or charges. Touch uses a left joystick, automatic turret aiming and tap/hold Fire.

Motion is **off by default**. On a supported touch device, tap **Motion: Off**
to request access. Hold the device steady until the first real reading centers
it, then tilt gently. **Calibrate** recenters it. The joystick overrides motion;
keyboard movement/turning takes precedence independently on each axis. Turning
motion off, pausing, losing focus or restarting releases its sensor listeners.
After pausing, tap Motion again if you want to resume using it.

Motion needs a supported browser, sensor access and a secure context (normally
HTTPS on an iPad). If denied, unsupported, unavailable or stalled, use the same
keyboard/joystick controls; the game keeps running. Screen rotation recenters
on the next valid sample. Actual Safari permission prompts and physical tilt
still need a real iPad check.

## Tests

Use Node 20 or newer. `npm install` installs development dependencies only.
`npm test` runs the focused controller and campaign tests. After installing the
Playwright Chromium browser (`npx playwright install chromium`), run
`npm run test:browser` for desktop/tablet/phone, weapons and campaign checks.

To use an installed Chrome instead, set `CHROME_PATH` to its executable. If
Playwright is provided by another runtime, set `PLAYWRIGHT_MODULE` to its module
path. Browser screenshots are saved under ignored `test-results/`.

## Publish on GitHub Pages

1. Create a new GitHub repository.
2. Upload `index.html`, `tank-game.html`, `theaters.js` and `motion-controls.js` together.
3. In GitHub, open `Settings` -> `Pages`.
4. Set the source to deploy from the main branch root.

GitHub Pages will serve `index.html` automatically.

The ZIP already in this repository is the historical May 2026 export; it does
not contain this repair. The HTML and JavaScript files above are the current app.
