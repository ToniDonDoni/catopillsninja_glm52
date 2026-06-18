# Neon Kitty Catcher

A browser game inspired by Fruit Ninja. Cats fly across the screen — catch them with your finger via webcam tracking, drag them into a glass on the right, and watch them transform into pills that dissolve in a burst of neon particles.

Built with vanilla HTML/CSS/JS (canvas-only architecture) and MediaPipe Hands for finger tracking. Includes full Playwright E2E test coverage.

## Visual Style

- Acidic, vibrant neon palette (hot pink, cyan, purple, acid yellow, magenta, electric blue)
- Glow effects on every entity (cats, pills, glass, cursor, grid)
- Psychedelic synthwave background (starfield + perspective grid + gradient)
- Particle systems (finger trails, catch bursts, drop sparkles, dissolve bursts)
- Combo popups with animated gradient title

## How to Play

1. Allow camera access when prompted (or add `?mouse` to the URL for mouse/touch control)
2. Move your finger (or mouse) to catch flying cats — they stick to your finger on proximity
3. Drag the caught cat to the glass on the right side of the screen
4. The cat transforms into a pill and dissolves — you earn points
5. Chain drops within 2 seconds for combo multipliers (x2)
6. Don't let too many cats fly off-screen — 10 misses ends the game
7. Survive the 60-second timer for a high score

## Installation

```bash
cd /work/catopillsninja_glm52
npm install
```

This installs Playwright. The game itself is static HTML/CSS/JS — no build step needed.

## Running the Game

```bash
npm start
```

Opens a static server at `http://localhost:8080`. Open in a browser.

- **Camera mode** (default): `http://localhost:8080/` — uses MediaPipe Hands for finger tracking
- **Mouse mode**: `http://localhost:8080/?mouse` — uses mouse/touch instead of camera

To use a different port: `PORT=3000 npm start`

## Running Tests

```bash
npm test
```

Runs all 21 Playwright E2E tests in headless Chromium. Tests use `?mouse` mode (no camera required) and a deterministic test API (`window.__game`) for reliable, fast assertions.

### Test Execution Results

```
Running 21 tests using 1 worker

  ✓  1  no console errors on startup
  ✓  2  start screen is visible on load
  ✓  3  window.__game exposes complete API
  ✓  4  start game hides start screen and shows HUD
  ✓  5  HUD shows initial values during gameplay
  ✓  6  forceSpawn creates a cat
  ✓  7  cats spawn automatically during gameplay
  ✓  8  proximity catch via setFingerPos
  ✓  9  caught cat follows finger
  ✓  10 drop cat into glass via finger → score increases
  ✓  11 forceDropIntoGlass → score increases
  ✓  12 transformation produces a pill
  ✓  13 combo: two quick catches give bonus score
  ✓  14 missed counter increases when cat flies off screen
  ✓  15 timer counts down during gameplay
  ✓  16 triggerGameOver shows game over screen
  ✓  17 game over screen shows final score
  ✓  18 game over after too many missed cats
  ✓  19 restart resets score and missed counters
  ✓  20 glass is positioned on the right side of the screen
  ✓  21 canvas renders non-blank content

  21 passed (57.0s)
```

All 21 tests pass successfully.

### Headed Mode (watch tests run)

```bash
npm run test:headed
```

### Viewing the Playwright Report

```bash
npm run test:report
```

Or open the report directly:

- **HTML report**: `playwright-report/index.html`
- **JSON report**: `test-results/results.json`
- **Last run status**: `test-results/.last-run.json`

The HTML report includes test traces, screenshots, and timing for each test.

## Test Coverage

| # | Test | Scenario |
|---|------|----------|
| 1 | No console errors | Page loads cleanly, no JS errors |
| 2 | Start screen visible | Initial UI state after load |
| 3 | API completeness | `window.__game` exposes all 16 methods |
| 4 | Start game flow | Click start → overlay hidden, HUD visible |
| 5 | HUD initial values | Score=0, timer>0, missed=0 at game start |
| 6 | Force spawn | `forceSpawn()` creates a flying cat |
| 7 | Natural spawn | Cats appear automatically during gameplay |
| 8 | Proximity catch | Finger near cat → cat state = caught |
| 9 | Cat follows finger | Caught cat tracks finger position |
| 10 | Drop via finger | Move caught cat to glass → score increases |
| 11 | Force drop | `forceDropIntoGlass()` → score increases |
| 12 | Pill transformation | Dropping cat spawns a pill effect |
| 13 | Combo bonus | Two quick drops = 10 + 20 = 30 points |
| 14 | Missed counter | Cat flies off screen → missed++ |
| 15 | Timer countdown | Time decreases over 2 seconds |
| 16 | Game over trigger | `triggerGameOver()` → game over screen |
| 17 | Final score display | Game over screen shows earned score |
| 18 | Game over by misses | 10 missed cats → game over |
| 19 | Restart | After restart, score and missed reset to 0 |
| 20 | Glass position | Glass is on the right side of screen |
| 21 | Visual render | Canvas has non-blank pixels (not a black void) |

## Project Structure

```
catopillsninja_glm52/
├── index.html              # Game page (MediaPipe scripts, game module, HUD, overlays)
├── server.js               # Static file server (PORT env, query-string strip, MIME)
├── package.json            # npm scripts + Playwright dependency
├── playwright.config.js    # Playwright config (webServer, reporters, camera args)
├── css/
│   └── style.css           # Neon/psychedelic styling for HUD and overlays
├── src/
│   ├── config.js           # Game balance constants (timing, speeds, colors, scoring)
│   ├── cat.js              # Cat entity + procedural canvas drawing + spawn functions
│   ├── glass.js            # Glass entity (hit zone, liquid animation, neon rendering)
│   ├── effects.js          # Particle, Pill, ParticleSystem (trails, bursts, dissolve)
│   ├── finger-tracker.js   # Unified input: MediaPipe Hands camera + mouse/touch fallback
│   ├── game.js             # Game engine: loop, state machine, scoring, spawning, rendering
│   └── main.js             # Wiring: DOM, canvas, tracker, game, window.__game API
├── tests/
│   └── game.spec.js        # 21 Playwright E2E tests
├── playwright-report/      # Generated HTML report (after test run)
└── test-results/           # Generated JSON report + last-run status
```

## Architecture

### Canvas-Only Rendering

All game entities (cats, glass, pills, particles, background, finger cursor) are drawn on a single full-viewport `<canvas>`. Only the HUD and overlay screens are DOM elements. This allows per-frame glow effects, custom shapes, and rotation/scale animations that would be difficult with DOM elements.

### Input Layer

`FingerTracker` provides a unified cursor (`{ x, y, visible, grabbing }`) regardless of input source:

- **Camera mode**: MediaPipe Hands tracks index fingertip (landmark 8). X is mirrored: `(1 - tip.x) * width`. Falls back to mouse on any failure.
- **Mouse/touch mode**: Pointer position drives the cursor. Always-pressing (Fruit-Ninja style — no click needed).
- **Test mode**: `setFingerPos(x, y)` / `hideFinger()` write directly to the cursor for deterministic tests.

### Test API

`window.__game` exposes read-only getters (`getState`, `getScore`, `getMissed`, `getTimeLeft`, `getCats`, `getGlass`, `getGameState`) and deterministic test handles (`forceSpawn`, `forceCatch`, `forceDropIntoGlass`, `moveCat`, `triggerGameOver`, `setFingerPos`, `hideFinger`, `startGame`). Created once, never reassigned on restart.

## Tech Stack

- **Runtime**: Node.js 22 (for static server + Playwright)
- **Game**: Vanilla HTML/CSS/JS, ES modules, Canvas 2D API
- **Input**: MediaPipe Hands (camera), mouse/touch fallback
- **Testing**: Playwright 1.61, headless Chromium
- **No build step**: served as static files
