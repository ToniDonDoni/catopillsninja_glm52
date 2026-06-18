// Visual effects: particles, pills, and the cat->pill transformation system.
// All drawn procedurally on the canvas with neon glow.

let _effectId = 1;

// --- Particle: small glowing dot with velocity and lifetime ---
export class Particle {
  constructor(x, y, vx, vy, color, life, size) {
    this.id = _effectId++;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.life = life; // seconds remaining
    this.maxLife = life;
    this.size = size;
    this.alive = true;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 60 * dt; // light gravity on particles
    this.vx *= 0.98; // air drag
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// --- Pill: the transformed cat, dissolves in the glass ---
export class Pill {
  constructor(x, y, colors) {
    this.id = _effectId++;
    this.x = x;
    this.y = y;
    this.colors = colors; // [leftColor, rightColor]
    this.w = 50;
    this.h = 22;
    this.life = 1.2; // PILL_DISSOLVE_MS / 1000
    this.maxLife = 1.2;
    this.alive = true;
    this.bob = 0;
    this.dissolving = false;
  }

  update(dt) {
    this.bob += dt * 4;
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }

  draw(ctx) {
    const t = 1 - this.life / this.maxLife; // 0..1 progress
    // Dissolve animation: scale up → brighten → shrink → fade
    let scale, alpha;
    if (t < 0.3) {
      scale = 1 + t * 1.5; // grow
      alpha = 1;
    } else if (t < 0.6) {
      scale = 1.45;
      alpha = 1;
    } else {
      scale = 1.45 * (1 - (t - 0.6) / 0.4); // shrink
      alpha = 1 - (t - 0.6) / 0.4; // fade
    }

    const yOff = Math.sin(this.bob) * 4;

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(this.x, this.y + yOff);
    ctx.scale(scale, scale);

    // Capsule shape
    const r = this.h / 2;
    ctx.shadowColor = this.colors[0];
    ctx.shadowBlur = 20;

    // Left half
    ctx.fillStyle = this.colors[0];
    ctx.beginPath();
    ctx.arc(-this.w / 2 + r, 0, r, Math.PI / 2, -Math.PI / 2);
    ctx.lineTo(0, -r);
    ctx.lineTo(0, r);
    ctx.closePath();
    ctx.fill();

    // Right half
    ctx.shadowColor = this.colors[1];
    ctx.fillStyle = this.colors[1];
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(this.w / 2 - r, -r);
    ctx.arc(this.w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(0, r);
    ctx.closePath();
    ctx.fill();

    // Divider line
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(0, r);
    ctx.stroke();

    ctx.restore();
  }
}

// --- ParticleSystem: manages all particles and pills ---
export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.pills = [];
  }

  clear() {
    this.particles = [];
    this.pills = [];
  }

  // Trail behind the finger cursor
  spawnTrail(x, y, color, count = 2) {
    for (let i = 0; i < count; i++) {
      this.particles.push(
        new Particle(
          x + (Math.random() - 0.5) * 10,
          y + (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 40,
          (Math.random() - 0.5) * 40,
          color,
          0.4 + Math.random() * 0.3,
          3 + Math.random() * 3
        )
      );
    }
  }

  // Burst when a cat is caught
  spawnCatchBurst(x, y, color) {
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const speed = 80 + Math.random() * 60;
      this.particles.push(
        new Particle(
          x, y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          color,
          0.5 + Math.random() * 0.3,
          3 + Math.random() * 4
        )
      );
    }
  }

  // Burst when a pill dissolves
  spawnDissolveBurst(x, y, colors) {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      const color = colors[Math.floor(Math.random() * colors.length)];
      this.particles.push(
        new Particle(
          x, y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          color,
          0.6 + Math.random() * 0.5,
          2 + Math.random() * 4
        )
      );
    }
  }

  // Sparkle when a cat is dropped into glass
  spawnDropSparkle(x, y) {
    for (let i = 0; i < 16; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
      const speed = 60 + Math.random() * 100;
      this.particles.push(
        new Particle(
          x, y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          ['#00f5d4', '#9b5de5', '#fee440'][Math.floor(Math.random() * 3)],
          0.5 + Math.random() * 0.4,
          2 + Math.random() * 4
        )
      );
    }
  }

  // Spawn a pill (cat -> pill transformation)
  spawnPill(x, y, colors) {
    this.pills.push(new Pill(x, y, colors));
  }

  update(dt) {
    for (const p of this.particles) p.update(dt);
    for (const p of this.pills) p.update(dt);
    this.particles = this.particles.filter((p) => p.alive);
    this.pills = this.pills.filter((p) => p.alive);
  }

  draw(ctx) {
    for (const p of this.particles) p.draw(ctx);
    for (const p of this.pills) p.draw(ctx);
  }

  // Snapshot for test API
  snapshot() {
    return {
      particles: this.particles.length,
      pills: this.pills.map((p) => ({ id: p.id, x: p.x, y: p.y, life: p.life })),
    };
  }
}
