import { state } from '../core/state.js';

/* Rubber-band resistance:
   - farther you drag -> harder it gets
   - clamps toward LIMIT via tanh
*/
function rubber(v, limit, damp) {
  const scaled = v * damp; // slow base movement
  return limit * Math.tanh(scaled / limit);
}

// Easing helpers
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);  // smooth ease-out
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class DragController {
  constructor({ viewport, canvas }) {
    this.viewport = viewport;
    this.canvas = canvas;

    // Tunables
    this.DAMPING       = 0.75;   // base drag slowdown (lower = stiffer)
    this.LIMIT_X       = 320;    // max pan reach in px
    this.LIMIT_Y       = 220;
    this.PRESS_SCALE   = 0.962;  // micro-zoom OUT intensity
    this.PAN_FOLLOW    = 0.20;   // pan lerp factor while dragging
    this.PRESS_IN_MS   = 260;    // how long to ease INTO press zoom
    this.RETURN_MS     = 520;    // how long to return to rest after release

    // Animation loop
    this._raf = null;

    // Pan state
    this._targetX = 0;
    this._targetY = 0;
    this._currX = 0;
    this._currY = 0;

    // Scale state (time-based tween)
    this._scaleCurr = 1;
    this._scaleFrom = 1;
    this._scaleTo   = 1;
    this._scaleT0   = 0;     // ms start
    this._scaleDur  = 0;     // ms duration
    this._scaleMode = 'idle';// 'press' | 'return' | 'idle'

    // Return tween for pan (time-based)
    this._panReturn = null; // {x0,y0,t0,dur}

    // Bindings
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp   = this._onMouseUp.bind(this);
    this._tick        = this._tick.bind(this);

    viewport.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);
  }

  /* Optional Devtools hooks */
  setTunables(opts = {}) {
    if ('DAMPING' in opts)     this.DAMPING    = Number(opts.DAMPING);
    if ('LIMIT_X' in opts)     this.LIMIT_X    = Number(opts.LIMIT_X);
    if ('LIMIT_Y' in opts)     this.LIMIT_Y    = Number(opts.LIMIT_Y);
    if ('PRESS_SCALE' in opts) this.PRESS_SCALE= Number(opts.PRESS_SCALE);
    if ('PAN_FOLLOW' in opts)  this.PAN_FOLLOW = Number(opts.PAN_FOLLOW);
    if ('PRESS_IN_MS' in opts) this.PRESS_IN_MS= Number(opts.PRESS_IN_MS);
    if ('RETURN_MS' in opts)   this.RETURN_MS  = Number(opts.RETURN_MS);
  }

  _readComputedStart() {
    // Re-sync to the ACTUAL on-screen values every gesture
    const cs = getComputedStyle(this.canvas.wrapper);
    const getNum = (name, fallback) => {
      const v = parseFloat(cs.getPropertyValue(name));
      return Number.isFinite(v) ? v : fallback;
    };
    this._currX     = getNum('--pan-x', 0);
    this._currY     = getNum('--pan-y', 0);
    this._scaleCurr = getNum('--scale', 1);

    // If camera had a different var value (shouldn't), prefer wrapper
    this.canvas.setOffset(this._currX, this._currY);
    this.canvas.setScale(this._scaleCurr);
  }

  _startRAF() {
    if (!this._raf) this._raf = requestAnimationFrame(this._tick);
  }
  _stopRAF() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  _onMouseDown(e) {
    if (state.active) return; // page open -> no drag
    e.preventDefault();

    state.drag.isDragging = true;
    state.drag.startX = e.clientX;
    state.drag.startY = e.clientY;

    // Disable CSS transitions (we fully control micro zoom/return in JS)
    this.canvas.setTransitionsEnabled(false);
    this.canvas.setCursor('grabbing');

    // Re-sync currents from computed values to avoid any stale state
    this._readComputedStart();

    // Cancel any in-flight return tween for pan
    this._panReturn = null;

    // Start press-zoom tween from current scale to PRESS_SCALE
    const now = performance.now();
    this._scaleFrom = this._scaleCurr;
    this._scaleTo   = this.PRESS_SCALE;
    this._scaleT0   = now;
    this._scaleDur  = this.PRESS_IN_MS;
    this._scaleMode = 'press';

    // Start loop
    this._startRAF();
  }

  _onMouseMove(e) {
    if (!state.drag.isDragging) return;

    const dx = e.clientX - state.drag.startX;
    const dy = e.clientY - state.drag.startY;

    // Rubber-band + baseline damping
    this._targetX = rubber(dx, this.LIMIT_X, this.DAMPING);
    this._targetY = rubber(dy, this.LIMIT_Y, this.DAMPING);
  }

  _onMouseUp() {
    if (!state.drag.isDragging) return;
    state.drag.isDragging = false;

    // Begin time-based return for both PAN and SCALE
    const now = performance.now();

    // Pan return tween
    this._panReturn = {
      x0: this._currX,
      y0: this._currY,
      t0: now,
      dur: this.RETURN_MS
    };
    this._targetX = 0;
    this._targetY = 0;

    // Scale return tween
    this._scaleFrom = this._scaleCurr;
    this._scaleTo   = 1;
    this._scaleT0   = now;
    this._scaleDur  = this.RETURN_MS;
    this._scaleMode = 'return';

    // Keep CSS transitions disabled until we fully finish the JS return.
    this.canvas.setCursor('grab');

    // Ensure loop is running to finish the return
    this._startRAF();
  }

  _tick(now) {
    // ---- PAN ----
    if (state.drag.isDragging) {
      // While dragging: follow rubber target with inertial lag
      this._currX += (this._targetX - this._currX) * this.PAN_FOLLOW;
      this._currY += (this._targetY - this._currY) * this.PAN_FOLLOW;
    } else if (this._panReturn) {
      // After release: time-based tween back to 0,0
      const { x0, y0, t0, dur } = this._panReturn;
      const t = clamp01((now - t0) / dur);
      const k = easeInOut(t);
      this._currX = x0 * (1 - k);
      this._currY = y0 * (1 - k);
      if (t >= 1) this._panReturn = null;
    }
    this.canvas.setOffset(this._currX, this._currY);

    // ---- SCALE (micro press zoom) ----
    if (this._scaleMode !== 'idle') {
      const t = clamp01((now - this._scaleT0) / this._scaleDur);
      const k = this._scaleMode === 'press' ? easeOut(t) : easeInOut(t);
      this._scaleCurr = this._scaleFrom + (this._scaleTo - this._scaleFrom) * k;
      this.canvas.setScale(this._scaleCurr);
      if (t >= 1) {
        // Snap end value to avoid float drift
        this._scaleCurr = this._scaleTo;
        this.canvas.setScale(this._scaleCurr);
        this._scaleMode = 'idle';
      }
    }

    // Finish?
    const panDone   = !state.drag.isDragging && !this._panReturn;
    const scaleDone = this._scaleMode === 'idle' && !state.drag.isDragging;

    if (panDone && scaleDone) {
      // Ensure exact rest
      this._currX = 0; this._currY = 0; this._targetX = 0; this._targetY = 0;
      this._scaleCurr = 1; this._scaleFrom = 1; this._scaleTo = 1;
      this.canvas.setOffset(0, 0);
      this.canvas.setScale(1);

      // Re-enable CSS transitions for other features (page-open zoom)
      this.canvas.setTransitionsEnabled(true);

      // Stop loop until next gesture
      this._stopRAF();
      return;
    }

    this._raf = requestAnimationFrame(this._tick);
  }

  destroy() {
    this.viewport.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
    this._stopRAF();
  }
}