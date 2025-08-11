// Devtools HUD with inline styles so it shows up even if your CSS partial isn't loaded.
// It automatically hooks into window.dots (the DotField instance).

export class Devtools {
  constructor({ canvas, drag, camera, wrapper } = {}) {
    this.canvas = canvas;
    this.drag = drag;
    this.camera = camera || document.querySelector('.camera');
    this.wrapper = wrapper || document.querySelector('.grid-wrapper');

    // Try to pick up the DotField instance; keep checking until it exists.
    this.dots = window.dots || null;

    this._statsRAF = null;
    this._root = null;

    this._mount();
    this._pollForDots();
  }

  _mount() {
    // Remove any previous HUD
    document.getElementById('devtools-hud')?.remove();

    const root = document.createElement('div');
    root.id = 'devtools-hud';
    root.innerHTML = `
      <div class="hdr">Devtools</div>

      <div class="row">
        <div class="label">Dot Radius</div>
        <input id="dt-radius" type="range" min="40" max="800" step="1" />
        <div id="dt-radius-val">—</div>
      </div>

      <div class="row">
        <div class="label">Twinkle Boost</div>
        <input id="dt-twinkle" type="range" min="1" max="6" step="1" value="1" />
        <div id="dt-twinkle-val">1×</div>
      </div>

      <div class="stats">
        <div class="badge" id="dt-dots">Dots: —</div>
        <div class="badge" id="dt-pan">Pan: 0,0</div>
        <div class="badge" id="dt-scale">Scale: 1.00</div>
      </div>
    `;
    document.body.appendChild(root);
    this._root = root;

    // Inline styles so it renders without external CSS
    const s = root.style;
    s.position = 'fixed';
    s.left = '12px';
    s.bottom = '12px';
    s.zIndex = '1000000';
    s.background = 'rgba(20,20,20,.78)';
    s.border = '1px solid rgba(255,255,255,.18)';
    s.borderRadius = '12px';
    s.padding = '10px 12px';
    s.width = '320px';
    s.font = '12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    s.color = '#ddd';
    s.backdropFilter = 'blur(4px)';

    // Minimal inline styles for internal elements
    const style = document.createElement('style');
    style.textContent = `
      #devtools-hud .hdr { font-weight:700; margin-bottom:8px; color:#fff; }
      #devtools-hud .row { display:grid; grid-template-columns: 110px 1fr 48px; gap:8px; align-items:center; margin:6px 0; }
      #devtools-hud input[type="range"] { width:100%; }
      #devtools-hud .stats { display:grid; grid-template-columns: repeat(3,1fr); gap:6px; margin-top:8px; }
      #devtools-hud .badge { padding:3px 6px; border:1px solid rgba(255,255,255,.2); border-radius:6px; text-align:center; }
    `;
    document.head.appendChild(style);

    // Wire controls
    this._wireRadius();
    this._wireTwinkle();
    this._startStatsLoop();

    console.log('[Devtools] HUD mounted');
  }

  _pollForDots() {
    // Keep trying to grab window.dots for 5s
    const t0 = performance.now();
    const tick = () => {
      if (!this.dots && window.dots) {
        this.dots = window.dots;
        // Initialize radius slider to live value
        const val = Math.round(this.dots.getInfluence?.() ?? 220);
        const input = this._root.querySelector('#dt-radius');
        const label = this._root.querySelector('#dt-radius-val');
        input.value = String(val);
        label.textContent = `${val}px`;
        console.log('[Devtools] Linked to window.dots');
      }
      if (!this.dots && performance.now() - t0 < 5000) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }

  /* ========== Controls ========== */

  _wireRadius() {
    const input = this._root.querySelector('#dt-radius');
    const label = this._root.querySelector('#dt-radius-val');

    // Start with whatever we have; will be corrected once dots is found
    const start = 220;
    input.value = String(start);
    label.textContent = `${start}px`;

    input.addEventListener('input', () => {
      const v = Number(input.value);
      if (this.dots?.setInfluence) this.dots.setInfluence(v);
      label.textContent = `${v}px`;
    });
  }

  _wireTwinkle() {
    const input = this._root.querySelector('#dt-twinkle');
    const label = this._root.querySelector('#dt-twinkle-val');
    input.addEventListener('input', () => {
      const v = Number(input.value);
      if (window.dots?.setTwinkleBoost) window.dots.setTwinkleBoost(v);
      label.textContent = `${v}×`;
    });
  }

  /* ========== Stats (pan/scale/dot count) ========== */
  _startStatsLoop() {
    const pan = this._root.querySelector('#dt-pan');
    const scale = this._root.querySelector('#dt-scale');
    const dots = this._root.querySelector('#dt-dots');

    const tick = () => {
      try {
        const cam = this.camera || document.querySelector('.camera');
        const cs = getComputedStyle(cam);
        const px = parseFloat(cs.getPropertyValue('--pan-x')) || 0;
        const py = parseFloat(cs.getPropertyValue('--pan-y')) || 0;
        const sc = parseFloat(cs.getPropertyValue('--scale')) || 1;

        pan.textContent = `Pan: ${Math.round(px)}, ${Math.round(py)}`;
        scale.textContent = `Scale: ${sc.toFixed(2)}`;

        const d = (this.dots && this.dots.dots) ? this.dots.dots.length : null;
        dots.textContent = `Dots: ${d ?? '—'}`;
      } catch {}
      this._statsRAF = requestAnimationFrame(tick);
    };
    this._statsRAF = requestAnimationFrame(tick);
  }

  destroy() {
    if (this._statsRAF) cancelAnimationFrame(this._statsRAF);
    this._root?.remove();
  }
}

export default Devtools;