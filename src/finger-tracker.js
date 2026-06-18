// FingerTracker — unified input layer for camera (MediaPipe Hands),
// mouse/touch fallback, and test handles.
//
// Exposes a single `cursor` object: { x, y, visible, grabbing }
// - Camera mode: visible = grabbing = hand detected (always-pressing)
// - Mouse mode: visible = grabbing = pointer on canvas (always-pressing)
// - Test mode: setFingerPos/hideFinger write directly to cursor
//
// The game loop reads tracker.cursor every frame — it doesn't care which
// input source is active.

export class FingerTracker {
  constructor(canvas, videoEl, previewCanvas) {
    this.canvas = canvas;
    this.videoEl = videoEl;
    this.previewCanvas = previewCanvas;
    this.previewCtx = previewCanvas?.getContext('2d') ?? null;

    // Unified cursor state — the only thing the game reads
    this.cursor = { x: 0, y: 0, visible: false, grabbing: false };

    this._mode = 'mouse'; // 'camera' | 'mouse'
    this._camera = null; // MediaPipe Camera instance
    this._hands = null; // MediaPipe Hands instance
    this._cleanupFns = [];
    this._trailColor = '#00f5d4';
  }

  // Initialize input. If useCamera=true, attempts MediaPipe Hands;
  // falls back to mouse on any failure.
  async init(useCamera) {
    if (useCamera && typeof window.Hands === 'function' && typeof window.Camera === 'function') {
      try {
        await this._initCamera();
        this._mode = 'camera';
        return true;
      } catch (err) {
        console.warn('Camera init failed, falling back to mouse:', err.message);
        this._cleanupCamera();
      }
    }
    this._initMouse();
    this._mode = 'mouse';
    return false;
  }

  // --- MediaPipe Hands setup ---
  async _initCamera() {
    const hands = new window.Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
    });
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    hands.onResults((results) => this._onHandResults(results));
    this._hands = hands;

    const camera = new window.Camera(this.videoEl, {
      onFrame: async () => {
        await hands.send({ image: this.videoEl });
      },
      width: 640,
      height: 480,
    });
    this._camera = camera;
    await camera.start();
  }

  _onHandResults(results) {
    // Draw mirrored preview
    if (this.previewCtx && results.image) {
      const pc = this.previewCanvas;
      const ctx = this.previewCtx;
      ctx.save();
      ctx.scale(-1, 1); // mirror
      ctx.drawImage(results.image, -pc.width, 0, pc.width, pc.height);
      ctx.restore();
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const tip = results.multiHandLandmarks[0][8]; // index fingertip
      // Mirror X: (1 - tip.x) * width — converts from camera space to screen space
      this.cursor.x = (1 - tip.x) * this.canvas.clientWidth;
      this.cursor.y = tip.y * this.canvas.clientHeight;
      this.cursor.visible = true;
      this.cursor.grabbing = true;
    } else {
      this.cursor.visible = false;
      this.cursor.grabbing = false;
    }
  }

  _cleanupCamera() {
    try { this._camera?.stop(); } catch (_) {}
    try { this._hands?.close(); } catch (_) {}
    this._camera = null;
    this._hands = null;
  }

  // --- Mouse / touch fallback ---
  _initMouse() {
    const c = this.canvas;

    const updateFromEvent = (e) => {
      const rect = c.getBoundingClientRect();
      this.cursor.x = e.clientX - rect.left;
      this.cursor.y = e.clientY - rect.top;
      this.cursor.visible = true;
      this.cursor.grabbing = true; // always-pressing (Fruit-Ninja style)
    };

    const onMouseLeave = () => {
      this.cursor.visible = false;
      this.cursor.grabbing = false;
    };

    const onTouchStart = (e) => {
      if (e.touches.length > 0) {
        const t = e.touches[0];
        const rect = c.getBoundingClientRect();
        this.cursor.x = t.clientX - rect.left;
        this.cursor.y = t.clientY - rect.top;
        this.cursor.visible = true;
        this.cursor.grabbing = true;
      }
    };

    const onTouchMove = (e) => {
      e.preventDefault(); // prevent scroll
      if (e.touches.length > 0) {
        const t = e.touches[0];
        const rect = c.getBoundingClientRect();
        this.cursor.x = t.clientX - rect.left;
        this.cursor.y = t.clientY - rect.top;
      }
    };

    const onTouchEnd = () => {
      this.cursor.visible = false;
      this.cursor.grabbing = false;
    };

    c.addEventListener('mousemove', updateFromEvent);
    c.addEventListener('mouseleave', onMouseLeave);
    c.addEventListener('touchstart', onTouchStart, { passive: false });
    c.addEventListener('touchmove', onTouchMove, { passive: false });
    c.addEventListener('touchend', onTouchEnd);

    this._cleanupFns.push(() => {
      c.removeEventListener('mousemove', updateFromEvent);
      c.removeEventListener('mouseleave', onMouseLeave);
      c.removeEventListener('touchstart', onTouchStart);
      c.removeEventListener('touchmove', onTouchMove);
      c.removeEventListener('touchend', onTouchEnd);
    });
  }

  // --- Test handles (write directly to cursor) ---
  setFingerPos(x, y) {
    this.cursor.x = x;
    this.cursor.y = y;
    this.cursor.visible = true;
    this.cursor.grabbing = true;
  }

  hideFinger() {
    this.cursor.visible = false;
    this.cursor.grabbing = false;
  }

  // --- Cursor rendering ---
  draw(ctx, fingerRadius) {
    if (!this.cursor.visible) return;
    const { x, y, grabbing } = this.cursor;

    ctx.save();
    // Outer glow dot
    ctx.shadowColor = this._trailColor;
    ctx.shadowBlur = 20;
    ctx.fillStyle = 'rgba(0, 245, 212, 0.7)';
    ctx.beginPath();
    ctx.arc(x, y, fingerRadius * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Grab ring (only when actively grabbing)
    if (grabbing) {
      ctx.strokeStyle = '#00f5d4';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(x, y, fingerRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  cleanup() {
    this._cleanupCamera();
    for (const fn of this._cleanupFns) fn();
    this._cleanupFns = [];
  }
}
