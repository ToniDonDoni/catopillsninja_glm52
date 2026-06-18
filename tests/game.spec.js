// E2E tests for Neon Kitty Catcher.
// All tests use ?mouse mode to avoid camera permission/phantom-hand issues.
// Tests use the deterministic window.__game API (read-only getters + test handles).

import { test, expect } from '@playwright/test';

const URL = '/?mouse';

// Helper: navigate, wait for init, click start, wait for playing state.
async function startGame(page) {
  await page.goto(URL);
  // Wait for __game API and start screen to be visible (post-init)
  await page.waitForFunction(
    () =>
      window.__game &&
      !document.getElementById('start-screen').classList.contains('hidden'),
    null,
    { timeout: 10000 }
  );
  await page.click('#start-btn');
  await page.waitForFunction(
    () => window.__game.getGameState() === 'playing',
    null,
    { timeout: 5000 }
  );
}

// ─── 1. Startup & API ───────────────────────────────────────────

test('no console errors on startup', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto(URL);
  await page.waitForFunction(() => window.__game, null, { timeout: 10000 });
  await page.waitForFunction(
    () => !document.getElementById('start-screen').classList.contains('hidden'),
    null,
    { timeout: 10000 }
  );
  expect(errors).toEqual([]);
});

test('start screen is visible on load', async ({ page }) => {
  await page.goto(URL);
  await page.waitForSelector('#start-screen:not(.hidden)', { timeout: 10000 });
  const visible = await page.isVisible('#start-screen');
  expect(visible).toBeTruthy();
});

test('window.__game exposes complete API', async ({ page }) => {
  await page.goto(URL);
  await page.waitForFunction(() => window.__game, null, { timeout: 10000 });
  const api = await page.evaluate(() =>
    Object.keys(window.__game).sort()
  );
  const expected = [
    'CONFIG',
    'forceCatch',
    'forceDropIntoGlass',
    'forceSpawn',
    'getCats',
    'getGlass',
    'getGameState',
    'getMissed',
    'getScore',
    'getState',
    'getTimeLeft',
    'hideFinger',
    'moveCat',
    'setFingerPos',
    'startGame',
    'triggerGameOver',
  ].sort();
  expect(api).toEqual(expected);
});

// ─── 2. Game Flow ───────────────────────────────────────────────

test('start game hides start screen and shows HUD', async ({ page }) => {
  await startGame(page);
  const startVisible = await page.isVisible('#start-screen');
  expect(startVisible).toBeFalsy();
  const hudVisible = await page.isVisible('#hud');
  expect(hudVisible).toBeTruthy();
});

test('HUD shows initial values during gameplay', async ({ page }) => {
  await startGame(page);
  await page.waitForTimeout(200); // let first HUD update fire
  const score = await page.textContent('#score-value');
  const timer = await page.textContent('#timer-value');
  const missed = await page.textContent('#missed-value');
  expect(parseInt(score, 10)).toBe(0);
  expect(parseInt(timer, 10)).toBeGreaterThan(0);
  expect(parseInt(missed, 10)).toBe(0);
});

// ─── 3. Spawning ────────────────────────────────────────────────

test('forceSpawn creates a cat', async ({ page }) => {
  await startGame(page);
  const catId = await page.evaluate(() => window.__game.forceSpawn());
  expect(catId).toBeGreaterThan(0);
  const cats = await page.evaluate(() => window.__game.getCats());
  const spawned = cats.find((c) => c.id === catId);
  expect(spawned).toBeDefined();
  expect(spawned.state).toBe('flying');
});

test('cats spawn automatically during gameplay', async ({ page }) => {
  await startGame(page);
  // First natural spawn at ~1800ms; wait 3s to be safe
  await page.waitForTimeout(3000);
  const state = await page.evaluate(() => window.__game.getState());
  expect(state.cats.length).toBeGreaterThan(0);
});

// ─── 4. Catching ────────────────────────────────────────────────

test('proximity catch via setFingerPos', async ({ page }) => {
  await startGame(page);
  const catId = await page.evaluate(() => window.__game.forceSpawn());
  // Move finger to the cat's position
  await page.evaluate((id) => {
    const cat = window.__game.getCats().find((c) => c.id === id);
    window.__game.setFingerPos(cat.x, cat.y);
  }, catId);
  await page.waitForTimeout(200); // let game loop process
  const cats = await page.evaluate(() => window.__game.getCats());
  const caught = cats.find((c) => c.id === catId);
  expect(caught).toBeDefined();
  expect(caught.state).toBe('caught');
});

test('caught cat follows finger', async ({ page }) => {
  await startGame(page);
  const catId = await page.evaluate(() => window.__game.forceSpawn());
  await page.evaluate((id) => window.__game.forceCatch(id), catId);
  // Move finger to a new position
  const target = { x: 300, y: 200 };
  await page.evaluate((pos) => window.__game.setFingerPos(pos.x, pos.y), target);
  await page.waitForTimeout(200);
  const cats = await page.evaluate(() => window.__game.getCats());
  const cat = cats.find((c) => c.id === catId);
  expect(cat).toBeDefined();
  expect(cat.state).toBe('caught');
  expect(Math.abs(cat.x - target.x)).toBeLessThan(15);
  expect(Math.abs(cat.y - target.y)).toBeLessThan(15);
});

// ─── 5. Dropping & Scoring ──────────────────────────────────────

test('drop cat into glass via finger → score increases', async ({ page }) => {
  await startGame(page);
  const catId = await page.evaluate(() => window.__game.forceSpawn());
  await page.evaluate((id) => window.__game.forceCatch(id), catId);
  // Move finger to glass center
  await page.evaluate(() => {
    const g = window.__game.getGlass();
    window.__game.setFingerPos(g.x + g.w / 2, g.y + g.h / 2);
  });
  await page.waitForTimeout(300);
  const score = await page.evaluate(() => window.__game.getScore());
  expect(score).toBeGreaterThan(0);
});

test('forceDropIntoGlass → score increases', async ({ page }) => {
  await startGame(page);
  const catId = await page.evaluate(() => window.__game.forceSpawn());
  await page.evaluate((id) => window.__game.forceCatch(id), catId);
  const result = await page.evaluate((id) =>
    window.__game.forceDropIntoGlass(id), catId
  );
  expect(result).toBe(true);
  const score = await page.evaluate(() => window.__game.getScore());
  expect(score).toBeGreaterThan(0);
});

test('transformation produces a pill', async ({ page }) => {
  await startGame(page);
  const catId = await page.evaluate(() => window.__game.forceSpawn());
  await page.evaluate((id) => window.__game.forceCatch(id), catId);
  await page.evaluate((id) => window.__game.forceDropIntoGlass(id), catId);
  await page.waitForTimeout(200);
  const state = await page.evaluate(() => window.__game.getState());
  expect(state.effects.pills.length).toBeGreaterThan(0);
});

test('combo: two quick catches give bonus score', async ({ page }) => {
  await startGame(page);
  // First cat: score += 10
  const id1 = await page.evaluate(() => window.__game.forceSpawn());
  await page.evaluate((id) => window.__game.forceCatch(id), id1);
  await page.evaluate((id) => window.__game.forceDropIntoGlass(id), id1);
  // Second cat within combo window: score += 20 (x2 multiplier)
  const id2 = await page.evaluate(() => window.__game.forceSpawn());
  await page.evaluate((id) => window.__game.forceCatch(id), id2);
  await page.evaluate((id) => window.__game.forceDropIntoGlass(id), id2);
  const score = await page.evaluate(() => window.__game.getScore());
  expect(score).toBe(30); // 10 + 20
});

// ─── 6. Missed & Timer ──────────────────────────────────────────

test('missed counter increases when cat flies off screen', async ({ page }) => {
  await startGame(page);
  const catId = await page.evaluate(() => window.__game.forceSpawn());
  // Teleport cat off-screen; game loop will count it as missed
  await page.evaluate((id) => window.__game.moveCat(id, 99999, 99999), catId);
  await page.waitForTimeout(300);
  const missed = await page.evaluate(() => window.__game.getMissed());
  expect(missed).toBeGreaterThanOrEqual(1);
});

test('timer counts down during gameplay', async ({ page }) => {
  await startGame(page);
  const t0 = await page.evaluate(() => window.__game.getTimeLeft());
  await page.waitForTimeout(2000);
  const t1 = await page.evaluate(() => window.__game.getTimeLeft());
  expect(t1).toBeLessThan(t0);
  // Should have decreased by roughly 2000ms (±800ms tolerance)
  expect(t0 - t1).toBeGreaterThan(1200);
  expect(t0 - t1).toBeLessThan(3200);
});

// ─── 7. Game Over & Restart ─────────────────────────────────────

test('triggerGameOver shows game over screen', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => window.__game.triggerGameOver());
  await page.waitForSelector('#game-over-screen:not(.hidden)', { timeout: 5000 });
  const visible = await page.isVisible('#game-over-screen');
  expect(visible).toBeTruthy();
  const state = await page.evaluate(() => window.__game.getGameState());
  expect(state).toBe('game_over');
});

test('game over screen shows final score', async ({ page }) => {
  await startGame(page);
  // Score some points first
  const catId = await page.evaluate(() => window.__game.forceSpawn());
  await page.evaluate((id) => window.__game.forceCatch(id), catId);
  await page.evaluate((id) => window.__game.forceDropIntoGlass(id), catId);
  await page.evaluate(() => window.__game.triggerGameOver());
  await page.waitForSelector('#game-over-screen:not(.hidden)', { timeout: 5000 });
  const text = await page.textContent('#final-score');
  expect(parseInt(text, 10)).toBeGreaterThan(0);
});

test('game over after too many missed cats', async ({ page }) => {
  await startGame(page);
  // Spawn and miss 10 cats (MAX_MISSED threshold)
  await page.evaluate(() => {
    for (let i = 0; i < 10; i++) {
      const id = window.__game.forceSpawn();
      window.__game.moveCat(id, 99999, 99999);
    }
  });
  await page.waitForTimeout(500);
  const state = await page.evaluate(() => window.__game.getGameState());
  expect(state).toBe('game_over');
  const visible = await page.isVisible('#game-over-screen');
  expect(visible).toBeTruthy();
});

test('restart resets score and missed counters', async ({ page }) => {
  await startGame(page);
  // Score some points and miss some cats
  const catId = await page.evaluate(() => window.__game.forceSpawn());
  await page.evaluate((id) => window.__game.forceCatch(id), catId);
  await page.evaluate((id) => window.__game.forceDropIntoGlass(id), catId);
  // End game
  await page.evaluate(() => window.__game.triggerGameOver());
  await page.waitForSelector('#game-over-screen:not(.hidden)', { timeout: 5000 });
  // Restart
  await page.click('#restart-btn');
  await page.waitForFunction(
    () => window.__game.getGameState() === 'playing',
    null,
    { timeout: 5000 }
  );
  const score = await page.evaluate(() => window.__game.getScore());
  const missed = await page.evaluate(() => window.__game.getMissed());
  expect(score).toBe(0);
  expect(missed).toBe(0);
});

// ─── 8. Layout & Visual ─────────────────────────────────────────

test('glass is positioned on the right side of the screen', async ({ page }) => {
  await startGame(page);
  const glass = await page.evaluate(() => window.__game.getGlass());
  const viewport = page.viewportSize();
  expect(glass).not.toBeNull();
  // Glass center should be in the right 30% of the screen
  const glassCenter = glass.x + glass.w / 2;
  expect(glassCenter).toBeGreaterThan(viewport.width * 0.7);
});

test('canvas renders non-blank content', async ({ page }) => {
  await startGame(page);
  // Spawn a few cats and wait for render
  await page.evaluate(() => {
    for (let i = 0; i < 3; i++) window.__game.forceSpawn();
  });
  await page.waitForTimeout(500);
  const hasPixels = await page.evaluate(() => {
    const c = document.getElementById('stage');
    const tmp = document.createElement('canvas');
    tmp.width = 32;
    tmp.height = 32;
    tmp.getContext('2d').drawImage(c, 0, 0, 32, 32, 0, 0, 32, 32);
    const data = tmp.getContext('2d').getImageData(0, 0, 32, 32).data;
    let nonZero = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] + data[i + 1] + data[i + 2] > 0) nonZero++;
    }
    return nonZero;
  });
  expect(hasPixels).toBeGreaterThan(50);
});

// ─── 9. Full Gameplay Loop (catch → drop → score → repeat) ──────

test('cursor visible at game start without mouse movement', async ({ page }) => {
  // RED: cursor should be visible immediately when game starts in mouse mode,
  // without requiring the user to move the mouse first.
  await startGame(page);
  // Do NOT move the mouse — just check cursor state
  const cursor = await page.evaluate(() => ({
    visible: window.__neon.tracker.cursor.visible,
    x: window.__neon.tracker.cursor.x,
    y: window.__neon.tracker.cursor.y,
  }));
  expect(cursor.visible).toBe(true);
  // Cursor should be somewhere on screen (not at 0,0)
  expect(cursor.x).toBeGreaterThan(0);
  expect(cursor.y).toBeGreaterThan(0);
});

test('full gameplay loop: catch, drop, score, repeat', async ({ page }) => {
  await startGame(page);

  // Helper: spawn a cat, catch it, drop it into the glass
  async function catchAndDrop() {
    const catId = await page.evaluate(() => window.__game.forceSpawn());
    await page.evaluate((id) => window.__game.forceCatch(id), catId);
    const ok = await page.evaluate((id) => window.__game.forceDropIntoGlass(id), catId);
    expect(ok).toBe(true);
    await page.waitForTimeout(150); // let game loop process
  }

  // Round 1: first catch, no combo → score = 10
  await catchAndDrop();
  expect(await page.evaluate(() => window.__game.getScore())).toBe(10);

  // Round 2: within combo window → x2 multiplier → score = 30
  await catchAndDrop();
  expect(await page.evaluate(() => window.__game.getScore())).toBe(30);

  // Wait past combo window (2s + buffer)
  await page.waitForTimeout(2500);

  // Round 3: combo reset → no multiplier → score = 40
  await catchAndDrop();
  expect(await page.evaluate(() => window.__game.getScore())).toBe(40);

  // Round 4: within combo window again → x2 → score = 60
  await catchAndDrop();
  expect(await page.evaluate(() => window.__game.getScore())).toBe(60);

  // Round 5: still within window → x2 → score = 80
  await catchAndDrop();
  expect(await page.evaluate(() => window.__game.getScore())).toBe(80);
});

test('mode indicator shows mouse mode when camera unavailable', async ({ page }) => {
  await startGame(page);
  // In ?mouse mode, a mode badge should be visible
  const badge = await page.textContent('#mode-badge').catch(() => null);
  // The badge should exist and indicate mouse mode
  expect(badge).not.toBeNull();
  expect(badge.toLowerCase()).toContain('mouse');
});
