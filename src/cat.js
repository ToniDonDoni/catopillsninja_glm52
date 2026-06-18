// Cat entity — the flying target the player catches and drops into the glass.
// State machine: flying -> caught -> transforming -> (removed by engine)
// All drawing is procedural on the canvas (no DOM elements per cat).

let _nextId = 1;

export class Cat {
  constructor(x, y, vx, vy, color, radius) {
    this.id = _nextId++;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.radius = radius;
    this.state = 'flying'; // flying | caught | transforming
    this.caughtTime = 0;
    this.transformTime = 0;
    this.rotation = Math.atan2(vy, vx);
    this.spinSpeed = (Math.random() - 0.5) * 2; // rad/s while flying
    this.bob = Math.random() * Math.PI * 2; // animation phase
    this.alive = true;
  }

  update(dt, bounds) {
    if (this.state === 'flying') {
      this.vy += 30 * dt; // gravity
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.rotation += this.spinSpeed * dt;
      this.bob += dt * 6;

      // Off-screen check (missed)
      if (
        this.x < -this.radius * 3 ||
        this.x > bounds.w + this.radius * 3 ||
        this.y > bounds.h + this.radius * 3
      ) {
        this.alive = false;
        return 'missed';
      }
    } else if (this.state === 'caught') {
      // Position is set by the engine (follows finger)
      this.bob += dt * 10;
    } else if (this.state === 'transforming') {
      this.transformTime += dt * 1000;
    }
    return null;
  }

  // Distance from a point to cat center
  distanceTo(x, y) {
    return Math.hypot(this.x - x, this.y - y);
  }

  // True if a point is within catchRadius of the cat
  contains(x, y, catchRadius) {
    return this.distanceTo(x, y) <= this.radius + catchRadius;
  }

  draw(ctx) {
    const r = this.radius;
    const pulse = this.state === 'caught' ? 1 + Math.sin(this.bob) * 0.08 : 1;
    const scale =
      this.state === 'transforming'
        ? Math.max(0, 1 - this.transformTime / 1800)
        : pulse;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.scale(scale, scale);

    // Neon glow
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 25;

    // Body — rounded shape
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Inner highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(-r * 0.25, -r * 0.25, r * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // Ears — two triangles
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 15;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, -r * 0.5);
    ctx.lineTo(-r * 0.3, -r * 1.2);
    ctx.lineTo(-r * 0.05, -r * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.05, -r * 0.55);
    ctx.lineTo(r * 0.3, -r * 1.2);
    ctx.lineTo(r * 0.6, -r * 0.5);
    ctx.closePath();
    ctx.fill();

    // Eyes — glowing white dots
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-r * 0.28, -r * 0.05, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.28, -r * 0.05, r * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1a0033';
    ctx.beginPath();
    ctx.arc(-r * 0.28, -r * 0.05, r * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.28, -r * 0.05, r * 0.05, 0, Math.PI * 2);
    ctx.fill();

    // Whiskers
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, r * 0.2);
    ctx.lineTo(-r * 0.9, r * 0.15);
    ctx.moveTo(-r * 0.3, r * 0.3);
    ctx.lineTo(-r * 0.9, r * 0.35);
    ctx.moveTo(r * 0.3, r * 0.2);
    ctx.lineTo(r * 0.9, r * 0.15);
    ctx.moveTo(r * 0.3, r * 0.3);
    ctx.lineTo(r * 0.9, r * 0.35);
    ctx.stroke();

    // Tail
    ctx.strokeStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.lineWidth = r * 0.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, r * 0.7);
    ctx.quadraticCurveTo(
      r * 0.5, r * 1.1,
      r * 0.3 + Math.sin(this.bob * 2) * r * 0.3, r * 1.4
    );
    ctx.stroke();

    ctx.restore();
  }
}

// Create a cat entering from a random edge with velocity toward the play area.
export function spawnCat(bounds) {
  const colors = CONFIG_CAT_COLORS;
  const color = colors[Math.floor(Math.random() * colors.length)];
  const radius = CONFIG_CAT_RADIUS;
  const speed = CONFIG_CAT_MIN_SPEED +
    Math.random() * (CONFIG_CAT_MAX_SPEED - CONFIG_CAT_MIN_SPEED);

  let x, y, vx, vy;
  const edge = Math.floor(Math.random() * 3); // 0=left, 1=top, 2=bottom

  if (edge === 0) {
    // Left edge → fly right
    x = -radius * 2;
    y = bounds.h * (0.2 + Math.random() * 0.6);
    vx = speed;
    vy = (Math.random() - 0.5) * speed * 0.4;
  } else if (edge === 1) {
    // Top edge → fly down-right
    x = bounds.w * (0.1 + Math.random() * 0.5);
    y = -radius * 2;
    vx = speed * 0.5;
    vy = speed * 0.6;
  } else {
    // Bottom edge → fly up-right
    x = bounds.w * (0.1 + Math.random() * 0.5);
    y = bounds.h + radius * 2;
    vx = speed * 0.5;
    vy = -speed * 0.6;
  }

  return new Cat(x, y, vx, vy, color, radius);
}

// Deterministic spawn for tests — always from left edge at mid-height.
export function spawnCatTest(bounds) {
  const color = CONFIG_CAT_COLORS[0];
  const radius = CONFIG_CAT_RADIUS;
  const speed = 180;
  return new Cat(
    -radius * 2,
    bounds.h * 0.5,
    speed,
    0,
    color,
    radius
  );
}

// Late-imported config to avoid circular deps; assigned by game.js on load.
let CONFIG_CAT_COLORS = ['#ff006e', '#00f5d4', '#9b5de5'];
let CONFIG_CAT_RADIUS = 38;
let CONFIG_CAT_MIN_SPEED = 120;
let CONFIG_CAT_MAX_SPEED = 260;

export function _setCatConfig(cfg) {
  CONFIG_CAT_COLORS = cfg.CAT_COLORS;
  CONFIG_CAT_RADIUS = cfg.CAT_RADIUS;
  CONFIG_CAT_MIN_SPEED = cfg.CAT_MIN_SPEED;
  CONFIG_CAT_MAX_SPEED = cfg.CAT_MAX_SPEED;
}
