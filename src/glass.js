// Glass entity — the drop target on the right side of the screen.
// Provides a bounding-box hit test and a neon visual with rising liquid.

export class Glass {
  constructor(bounds) {
    this.x = bounds.x;
    this.y = bounds.y;
    this.w = bounds.w;
    this.h = bounds.h;
    this.liquidLevel = 0.3; // 0..1, how full the glass is
    this.targetLiquid = 0.3;
    this.bob = 0;
  }

  // Update glass bounds on resize
  setBounds(bounds) {
    this.x = bounds.x;
    this.y = bounds.y;
    this.w = bounds.w;
    this.h = bounds.h;
  }

  // True if a point is inside the glass hit zone
  containsPoint(x, y) {
    return (
      x >= this.x &&
      x <= this.x + this.w &&
      y >= this.y &&
      y <= this.y + this.h
    );
  }

  // Center point (for test handles and particle spawning)
  center() {
    return { x: this.x + this.w / 2, y: this.y + this.h / 2 };
  }

  update(dt) {
    this.bob += dt * 3;
    // Smooth liquid level toward target
    this.liquidLevel += (this.targetLiquid - this.liquidLevel) * dt * 4;
  }

  // Raise liquid when a cat is dropped in
  fill(amount) {
    this.targetLiquid = Math.min(0.85, this.targetLiquid + amount);
  }

  draw(ctx) {
    const { x, y, w, h } = this;
    const cx = x + w / 2;
    const rimY = y;
    const bottomY = y + h;
    const taper = w * 0.15; // glass narrows toward bottom

    ctx.save();

    // Outer glow
    ctx.shadowColor = '#00f5d4';
    ctx.shadowBlur = 30;

    // Glass body outline (trapezoid)
    ctx.strokeStyle = '#00f5d4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, rimY);
    ctx.lineTo(x + taper, bottomY);
    ctx.lineTo(x + w - taper, bottomY);
    ctx.lineTo(x + w, rimY);
    ctx.stroke();

    // Rim ellipse
    ctx.beginPath();
    ctx.ellipse(cx, rimY, w / 2, w * 0.1, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Liquid inside
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#9b5de5';
    const liquidH = h * this.liquidLevel;
    const liquidY = bottomY - liquidH;
    const liquidTopWidth = w - (taper * 2 * (1 - this.liquidLevel));
    const liquidTopX = cx - liquidTopWidth / 2;

    ctx.fillStyle = 'rgba(155, 93, 229, 0.5)';
    ctx.beginPath();
    ctx.moveTo(liquidTopX, liquidY);
    ctx.lineTo(x + taper, bottomY);
    ctx.lineTo(x + w - taper, bottomY);
    ctx.lineTo(liquidTopX + liquidTopWidth, liquidY);
    ctx.closePath();
    ctx.fill();

    // Liquid surface ripple
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.8)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00f5d4';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(liquidTopX, liquidY);
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const rippleX = liquidTopX + liquidTopWidth * t;
      const rippleY = liquidY + Math.sin(this.bob * 2 + t * Math.PI * 3) * 3;
      ctx.lineTo(rippleX, rippleY);
    }
    ctx.stroke();

    // "DROP HERE" label
    ctx.shadowBlur = 8;
    ctx.fillStyle = `rgba(0, 245, 212, ${0.6 + Math.sin(this.bob) * 0.2})`;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DROP', cx, rimY - 20);
    ctx.fillText('HERE', cx, rimY - 6);

    ctx.restore();
  }
}
