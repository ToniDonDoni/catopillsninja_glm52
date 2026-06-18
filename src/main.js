// main.js — wires DOM, canvas, tracker, and game together.
// Exposes window.__game (test API) and window.__neon (live handles).

import { CONFIG } from './config.js';
import { Game, GAME_STATE } from './game.js';
import { FingerTracker } from './finger-tracker.js';

// --- URL params ---
const params = new URLSearchParams(window.location.search);
const forceMouse = params.has('mouse') || params.has('mode') && params.get('mode') === 'mouse';
const noCam = params.has('nocam') || forceMouse;
const useCamera = !noCam;

// --- DOM elements ---
const canvas = document.getElementById('stage');
const camPreview = document.getElementById('cam-preview');
const videoEl = document.getElementById('cam');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const scoreEl = document.getElementById('score-value');
const timerEl = document.getElementById('timer-value');
const missedEl = document.getElementById('missed-value');
const finalScoreEl = document.getElementById('final-score');
const comboPopup = document.getElementById('combo-popup');
const loadingScreen = document.getElementById('loading-screen');
const modeBadge = document.getElementById('mode-badge');
const inputHint = document.getElementById('input-hint');

// --- Canvas DPR setup (crisp on retina) ---
function setupCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

let ctx = setupCanvas();

// --- UI helpers ---
function showScreen(screen) {
  // Hide all overlays, then show the requested one (null = hide all)
  if (startScreen) startScreen.classList.add('hidden');
  if (gameOverScreen) gameOverScreen.classList.add('hidden');
  if (loadingScreen) loadingScreen.classList.add('hidden');
  if (screen) screen.classList.remove('hidden');
}

function updateHud(hud) {
  if (scoreEl) scoreEl.textContent = String(hud.score);
  if (timerEl) timerEl.textContent = String(hud.timeLeft);
  if (missedEl) missedEl.textContent = String(hud.missed);
}

function showComboPopup(multiplier, x, y) {
  if (!comboPopup) return;
  comboPopup.textContent = `COMBO x${multiplier}!`;
  comboPopup.style.left = `${x}px`;
  comboPopup.style.top = `${y}px`;
  comboPopup.classList.remove('show');
  // Force reflow to restart animation
  void comboPopup.offsetWidth;
  comboPopup.classList.add('show');
}

// --- Create tracker and game ---
const tracker = new FingerTracker(canvas, videoEl, camPreview);

const game = new Game(canvas, ctx, tracker, {
  onStateChange: (newState, reason, data) => {
    if (newState === GAME_STATE.PLAYING) {
      showScreen(null); // hide all overlays during play
    } else if (newState === GAME_STATE.GAME_OVER) {
      if (finalScoreEl) finalScoreEl.textContent = String(data?.score ?? 0);
      showScreen(gameOverScreen);
    }
  },
  onHudUpdate: updateHud,
  onCombo: showComboPopup,
});

// --- Resize handling ---
function onResize() {
  ctx = setupCanvas();
  game.ctx = ctx;
  game.onResize();
}
window.addEventListener('resize', onResize);

// --- Button handlers ---
startBtn?.addEventListener('click', () => game.start());
restartBtn?.addEventListener('click', () => game.start());

// --- Initialize input ---
(async () => {
  try {
    const cameraActive = await tracker.init(useCamera);
    // Show/hide camera preview based on mode
    if (camPreview) {
      camPreview.style.display = cameraActive ? 'block' : 'none';
    }
    // Update mode badge
    if (modeBadge) {
      modeBadge.textContent = cameraActive ? 'CAMERA MODE' : 'MOUSE MODE';
      modeBadge.classList.toggle('camera', cameraActive);
      modeBadge.classList.toggle('mouse', !cameraActive);
    }
    // Show fallback message on start screen if camera unavailable
    if (!cameraActive && inputHint) {
      inputHint.innerHTML =
        '🎮 <strong>MOUSE MODE</strong> — move your mouse to control the cursor. ' +
        'To use camera, ensure webcam is available and allowed.';
    }
  } catch (err) {
    console.warn('Input init error:', err);
    if (modeBadge) {
      modeBadge.textContent = 'MOUSE MODE';
      modeBadge.classList.add('mouse');
    }
  }
  // Hide loading, show start screen
  showScreen(startScreen);
})();

// --- Expose test API (created once, never reassigned) ---
window.__game = {
  // Read-only getters
  getState: () => game.getState(),
  getScore: () => game.getScore(),
  getMissed: () => game.getMissed(),
  getTimeLeft: () => game.getTimeLeft(),
  getGameState: () => game.getGameState(),
  getCats: () => game.getCats(),
  getGlass: () => game.getGlass(),
  CONFIG: CONFIG,

  // Test handles
  setFingerPos: (x, y) => tracker.setFingerPos(x, y),
  hideFinger: () => tracker.hideFinger(),
  startGame: () => game.start(),
  forceSpawn: () => game.forceSpawn(),
  forceCatch: (id) => game.forceCatch(id),
  forceDropIntoGlass: (id) => game.forceDropIntoGlass(id),
  moveCat: (id, x, y) => game.moveCat(id, x, y),
  triggerGameOver: () => game.triggerGameOver(),
};

// --- Expose live handles ---
window.__neon = { game, tracker, ui: { showScreen, updateHud } };

// --- Expose version ---
window.__version = CONFIG.APP_VERSION;
