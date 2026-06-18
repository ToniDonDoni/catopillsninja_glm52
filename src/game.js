// Game engine — owns the loop, state machine, entities, and scoring.
// Canvas-only architecture: all rendering on a single full-viewport canvas.
// HUD and overlays are DOM, updated via callbacks.

import { CONFIG } from './config.js';
import { Cat, spawnCat, spawnCatTest, _setCatConfig } from './cat.js';
import { Glass } from './glass.js';
import { ParticleSystem } from './effects.js';

// Inject config into cat module (avoids circular import)
_setCatConfig(CONFIG);

export const GAME_STATE = {
  IDLE: 'idle',
  PLAYING: 'playing',
  GAME_OVER: 'game_over',
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export class Game {
  constructor(canvas, ctx, tracker, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.tracker = tracker;
    this.callbacks = callbacks; // { onStateChange, onHudUpdate, onCombo }

    // Glass is created on start() when canvas bounds are known
    this.glass = null;
    this.particles = new ParticleSystem();

    // State — single mutable object, reset on each start
    this.state = this._freshState();

    // Precompute starfield for background
    this._stars = [];
    for (let i = 0; i < 80; i++) {
      this._stars.push({
        x: Math.random(),
        y: Math.random() * 0.6,
        size: 0.5 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 2,
      });
    }
    this._bgTime = 0;
  }

  _freshState() {
    return {
      gameState: GAME_STATE.IDLE,
      score: 0,
      missed: 0,
      comboCount: 0,
      lastCatchTime: 0,
      timeLeft: CONFIG.GAME_DURATION_MS,
      lastFrameTime: 0,
      spawnTimer: 0,
      spawnInterval: CONFIG.SPAWN_INTERVAL_MS_START,
      cats: [],
      animFrameId: null,
    };
  }

  // Compute glass bounds from canvas dimensions
  _glassBounds() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const gw = w * CONFIG.GLASS_WIDTH_RATIO;
    const gh = h * CONFIG.GLASS_HEIGHT_RATIO;
    return {
      x: w - gw - CONFIG.GLASS_MARGIN_RIGHT,
      y: h * CONFIG.GLASS_VERTICAL_CENTER - gh / 2,
      w: gw,
      h: gh,
    };
  }

  // --- Lifecycle ---

  start() {
    // Cancel any existing loop
    if (this.state.animFrameId) {
      cancelAnimationFrame(this.state.animFrameId);
    }
    // Reset state
    const oldState = this.state;
    this.state = this._freshState();
    this.state.gameState = GAME_STATE.PLAYING;
    this.state.lastFrameTime = performance.now();

    // Reset glass
    this.glass = new Glass(this._glassBounds());
    this.particles.clear();

    // Notify UI
    this.callbacks.onStateChange?.(GAME_STATE.PLAYING);
    this._updateHud();

    // Start loop
    this.state.animFrameId = requestAnimationFrame((t) => this._loop(t));
  }

  endGame(reason = 'unknown') {
    if (this.state.gameState === GAME_STATE.GAME_OVER) return;
    this.state.gameState = GAME_STATE.GAME_OVER;
    if (this.state.animFrameId) {
      cancelAnimationFrame(this.state.animFrameId);
      this.state.animFrameId = null;
    }
    this.callbacks.onStateChange?.(GAME_STATE.GAME_OVER, reason, {
      score: this.state.score,
      missed: this.state.missed,
    });
  }

  // --- Game loop ---

  _loop(timestamp) {
    if (this.state.gameState !== GAME_STATE.PLAYING) return;

    const dt = Math.min((timestamp - this.state.lastFrameTime) / 1000, 0.05);
    this.state.lastFrameTime = timestamp;

    this._update(dt);
    this._render();
    this._updateHud();

    this.state.animFrameId = requestAnimationFrame((t) => this._loop(t));
  }

  _update(dt) {
    const bounds = { w: this.canvas.clientWidth, h: this.canvas.clientHeight };
    this._bgTime += dt;

    // Timer
    this.state.timeLeft -= dt * 1000;

    // Spawn ramping
    this.state.spawnTimer += dt * 1000;
    const elapsed = CONFIG.GAME_DURATION_MS - this.state.timeLeft;
    const rampT = Math.min(1, elapsed / CONFIG.SPAWN_RAMP_TIME_MS);
    this.state.spawnInterval = lerp(
      CONFIG.SPAWN_INTERVAL_MS_START,
      CONFIG.SPAWN_INTERVAL_MS_END,
      rampT
    );
    if (this.state.spawnTimer >= this.state.spawnInterval) {
      this._spawnCat(bounds);
      this.state.spawnTimer = 0;
    }

    // Update cats
    for (const cat of this.state.cats) {
      const result = cat.update(dt, bounds);
      if (result === 'missed') {
        this.state.missed++;
      }
      // Check transformation completion
      if (
        cat.state === 'transforming' &&
        cat.transformTime >= CONFIG.TRANSFORM_DURATION_MS
      ) {
        cat.alive = false;
        const center = this.glass.center();
        this.particles.spawnDissolveBurst(center.x, center.y, CONFIG.CAT_COLORS);
      }
    }
    this.state.cats = this.state.cats.filter((c) => c.alive);

    // Finger interaction
    this._handleFingerInteraction(dt);

    // Effects + glass
    this.particles.update(dt);
    this.glass.update(dt);

    // Game over check
    this._checkGameOver();
  }

  _spawnCat(bounds) {
    const cat = spawnCat(bounds);
    this.state.cats.push(cat);
  }

  _handleFingerInteraction(dt) {
    const c = this.tracker.cursor;
    if (!c.visible || !c.grabbing) return;

    // Trail particles
    if (Math.random() < 0.6) {
      this.particles.spawnTrail(c.x, c.y, '#00f5d4');
    }

    // Find currently caught cat
    const caughtCat = this.state.cats.find(
      (cat) => cat.state === 'caught'
    );

    if (!caughtCat) {
      // Try to catch a flying cat (proximity)
      for (const cat of this.state.cats) {
        if (cat.state !== 'flying') continue;
        if (cat.contains(c.x, c.y, CONFIG.CATCH_RADIUS)) {
          cat.state = 'caught';
          cat.caughtTime = performance.now();
          this.particles.spawnCatchBurst(cat.x, cat.y, cat.color);
          break; // one catch per frame
        }
      }
    } else {
      // Move caught cat to finger
      caughtCat.x = c.x;
      caughtCat.y = c.y;

      // Check glass drop
      if (this.glass.containsPoint(c.x, c.y)) {
        this._dropIntoGlass(caughtCat);
      }
    }
  }

  _dropIntoGlass(cat) {
    cat.state = 'transforming';
    cat.transformTime = 0;

    // Spawn pill at glass center
    const center = this.glass.center();
    const pillColors =
      CONFIG.PILL_COLORS[Math.floor(Math.random() * CONFIG.PILL_COLORS.length)];
    this.particles.spawnPill(center.x, center.y, pillColors);
    this.particles.spawnDropSparkle(center.x, center.y);

    // Fill glass liquid
    this.glass.fill(0.08);

    // Score with combo
    const now = performance.now();
    if (now - this.state.lastCatchTime < CONFIG.COMBO_WINDOW_MS) {
      this.state.comboCount++;
    } else {
      this.state.comboCount = 1;
    }
    this.state.lastCatchTime = now;

    const multiplier =
      this.state.comboCount >= 2 ? CONFIG.COMBO_MULTIPLIER : 1;
    const points = CONFIG.SCORE_PER_CAT * multiplier;
    this.state.score += points;

    // Combo popup
    if (multiplier > 1) {
      this.callbacks.onCombo?.(multiplier, center.x, center.y);
    }
  }

  _checkGameOver() {
    if (this.state.timeLeft <= 0) {
      this.endGame('time_up');
    } else if (this.state.missed >= CONFIG.MAX_MISSED) {
      this.endGame('too_many_missed');
    }
  }

  // --- Rendering ---

  _render() {
    const ctx = this.ctx;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Background
    this._drawBackground(ctx, w, h);

    // Glass
    if (this.glass) this.glass.draw(ctx);

    // Cats
    for (const cat of this.state.cats) {
      cat.draw(ctx);
    }

    // Effects (pills + particles)
    this.particles.draw(ctx);

    // Finger cursor
    this.tracker.draw(ctx, CONFIG.FINGER_RADIUS);
  }

  _drawBackground(ctx, w, h) {
    // Gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0a0015');
    grad.addColorStop(0.5, '#1a0033');
    grad.addColorStop(1, '#0d001a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Stars
    const t = this._bgTime;
    for (const star of this._stars) {
      const alpha = 0.2 + Math.sin(t * star.speed + star.phase) * 0.3;
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, alpha)})`;
      ctx.beginPath();
      ctx.arc(star.x * w, star.y * h, star.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Neon grid (synthwave perspective floor)
    const vpY = h * 0.35;
    const gridScroll = (t * 60) % 60;

    // Horizontal lines
    ctx.strokeStyle = 'rgba(155, 93, 229, 0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 15; i++) {
      const baseY = vpY + i * 60 + gridScroll;
      if (baseY > h) continue;
      const perspective = (baseY - vpY) / (h - vpY);
      ctx.globalAlpha = Math.min(1, perspective * 0.6);
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      ctx.lineTo(w, baseY);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Vertical converging lines
    const cx = w / 2;
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.2)';
    for (let i = -8; i <= 8; i++) {
      if (i === 0) continue;
      const x = cx + i * (w / 10);
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(cx, vpY);
      ctx.stroke();
    }
  }

  // --- HUD update (only when values change) ---

  _lastHud = { score: -1, missed: -1, timeLeft: -1, combo: -1 };

  _updateHud() {
    const hud = {
      score: this.state.score,
      missed: this.state.missed,
      timeLeft: Math.max(0, Math.ceil(this.state.timeLeft / 1000)),
      combo: this.state.comboCount,
    };
    if (
      hud.score !== this._lastHud.score ||
      hud.missed !== this._lastHud.missed ||
      hud.timeLeft !== this._lastHud.timeLeft ||
      hud.combo !== this._lastHud.combo
    ) {
      this._lastHud = hud;
      this.callbacks.onHudUpdate?.(hud);
    }
  }

  // --- Public API for window.__game (read-only getters + test handles) ---

  getState() {
    return {
      gameState: this.state.gameState,
      score: this.state.score,
      missed: this.state.missed,
      comboCount: this.state.comboCount,
      timeLeft: Math.max(0, this.state.timeLeft),
      cats: this.state.cats.map((c) => ({
        id: c.id,
        x: c.x,
        y: c.y,
        vx: c.vx,
        vy: c.vy,
        state: c.state,
        color: c.color,
        radius: c.radius,
      })),
      effects: this.particles.snapshot(),
      glass: this.glass
        ? { x: this.glass.x, y: this.glass.y, w: this.glass.w, h: this.glass.h }
        : null,
    };
  }

  getScore() {
    return this.state.score;
  }

  getMissed() {
    return this.state.missed;
  }

  getTimeLeft() {
    return Math.max(0, this.state.timeLeft);
  }

  getGameState() {
    return this.state.gameState;
  }

  getCats() {
    return this.state.cats.map((c) => ({ ...c }));
  }

  getGlass() {
    if (!this.glass) return null;
    return { x: this.glass.x, y: this.glass.y, w: this.glass.w, h: this.glass.h };
  }

  // --- Test handles (deterministic, no timing assumptions) ---

  // Spawn a cat at a fixed position (left edge, mid-height, moving right)
  forceSpawn() {
    const bounds = { w: this.canvas.clientWidth, h: this.canvas.clientHeight };
    const cat = spawnCatTest(bounds);
    this.state.cats.push(cat);
    return cat.id;
  }

  // Force-catch a cat by id (sets state to caught, moves finger to cat)
  forceCatch(catId) {
    const cat = this.state.cats.find((c) => c.id === catId);
    if (!cat) return false;
    cat.state = 'caught';
    cat.caughtTime = performance.now();
    this.tracker.setFingerPos(cat.x, cat.y);
    return true;
  }

  // Force-drop a cat into the glass (teleport to glass center, trigger transform)
  forceDropIntoGlass(catId) {
    const cat = this.state.cats.find((c) => c.id === catId);
    if (!cat || cat.state !== 'caught') return false;
    const center = this.glass.center();
    cat.x = center.x;
    cat.y = center.y;
    this._dropIntoGlass(cat);
    return true;
  }

  // Move a cat to a specific position
  moveCat(catId, x, y) {
    const cat = this.state.cats.find((c) => c.id === catId);
    if (!cat) return false;
    cat.x = x;
    cat.y = y;
    return true;
  }

  // Force game over
  triggerGameOver() {
    this.endGame('test_trigger');
  }

  // --- Resize handling ---
  onResize() {
    if (this.glass) {
      this.glass.setBounds(this._glassBounds());
    }
  }
}
