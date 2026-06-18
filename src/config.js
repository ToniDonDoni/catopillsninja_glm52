// Game balance constants and configuration.
// All tunable values live here so the game logic stays clean.

export const CONFIG = {
  APP_VERSION: '1.0.0',

  // Game duration & lose conditions
  GAME_DURATION_MS: 60000,
  MAX_MISSED: 10,

  // Spawn ramp: interval shrinks from start to end over ramp time
  SPAWN_INTERVAL_MS_START: 1800,
  SPAWN_INTERVAL_MS_END: 800,
  SPAWN_RAMP_TIME_MS: 50000,

  // Cat physics
  CAT_RADIUS: 38,
  CAT_MIN_SPEED: 120,
  CAT_MAX_SPEED: 260,
  GRAVITY: 30, // px/s^2, subtle downward pull

  // Catching
  CATCH_RADIUS: 60,
  FINGER_RADIUS: 18,

  // Scoring
  SCORE_PER_CAT: 10,
  COMBO_WINDOW_MS: 2000,
  COMBO_MULTIPLIER: 2,

  // Transformation animation timings
  TRANSFORM_DURATION_MS: 1800, // cat -> pill morph
  PILL_DISSOLVE_MS: 1200, // pill fade out

  // Glass placement (right side of screen)
  GLASS_WIDTH_RATIO: 0.14,
  GLASS_HEIGHT_RATIO: 0.38,
  GLASS_MARGIN_RIGHT: 50,
  GLASS_VERTICAL_CENTER: 0.5,

  // Acidic neon palette for cats
  CAT_COLORS: [
    '#ff006e', // hot pink
    '#00f5d4', // cyan
    '#9b5de5', // purple
    '#f15bb5', // magenta
    '#fee440', // acid yellow
    '#00bbf9', // electric blue
  ],

  // Pill colors (two halves)
  PILL_COLORS: [
    ['#00f5d4', '#9b5de5'],
    ['#fee440', '#ff006e'],
    ['#00bbf9', '#f15bb5'],
  ],
};
