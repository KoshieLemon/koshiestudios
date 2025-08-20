import { defaultConfig } from './config.js';
import { Cursor } from './cursor.js';
import { MouseMapper } from './mouse.js';
import { VirtualGrid } from './grid.js';
import { stepPhysics } from './physics.js';
import { Twinkle } from './twinkle.js';

export class DotField {
  constructor({ camera, viewport, spacing = defaultConfig.spacing, size = defaultConfig.size, color = defaultConfig.color } = {}) {
    if (!camera || !viewport) throw new Error('[DotField] camera + viewport required');
    this.camera = camera;
    this.viewport = viewport;

    this.cfg = {
      spacing, size, color,
      influence: defaultConfig.influence(spacing),
      maxDisp:   defaultConfig.maxDisp(spacing),
      springK: defaultConfig.springK,
      damping: defaultConfig.damping,
      repelK: defaultConfig.repelK
    };

    // Layer under camera
    this.layer = document.createElement('div');
    this.layer.className = 'dot-layer';
    this.camera.insertBefore(this.layer, this.camera.firstChild);

    // Cursor + mouse
    this.cursor = new Cursor(defaultConfig.cursor);
    this.mouse = new MouseMapper({ layer: this.layer, viewport: this.viewport });

    // Virtual grid
    this.grid = new VirtualGrid({
      layer: this.layer,
      camera: this.camera,
      viewport: this.viewport,
      spacing: this.cfg.spacing,
      size: this.cfg.size,
      color: this.cfg.color,
      updatePanThreshold: 0.25,
      updateScaleThreshold: 0.01,
    });

    // Initial build
    this.grid.updateIfNeeded();
    this.dots = this.grid.getDots();

    // Twinkle
    this.twinkle = new Twinkle({
      dots: this.dots,
      size: this.cfg.size,
      color: this.cfg.color,
      minMs: defaultConfig.twinkleMin,
      maxMs: defaultConfig.twinkleMax
    });
    this.twinkle.start();

    // Loop
    this._tick = this._tick.bind(this);
    this._raf = requestAnimationFrame(this._tick);

    // Resize listener
    this._onResize = () => this.grid.updateIfNeeded();
    window.addEventListener('resize', this._onResize);

    if (!window.dots) window.dots = this;
    document.dispatchEvent(new CustomEvent('dotfield:ready', { detail: { dots: this } }));
  }

  getInfluence() { return this.cfg.influence; }
  setInfluence(px) { const v = +px; if (Number.isFinite(v) && v > 0) this.cfg.influence = v; }

  _tick() {
    this.grid.updateIfNeeded();
    this.dots = this.grid.getDots();
    this.twinkle.dots = this.dots;

    const hot = this.mouse.latestClient()?.target?.closest?.(
      'a,button,[role="button"],input,select,textarea,.cell:not(.disabled),[data-clickable],.site-nav a'
    );
    this.cursor.setHot(!!hot);

    const client = this.mouse.latestClient();
    if (client) this.cursor.move(client.x, client.y);

    const { x, y, inside } = this.mouse;
    stepPhysics(this.dots, { x, y, inside }, this.cfg);

    this._raf = requestAnimationFrame(this._tick);
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    this.twinkle.stop();
    this.mouse.destroy();
    this.cursor.destroy();
    window.removeEventListener('resize', this._onResize);
    this.layer.remove();
    this.dots.length = 0;
  }

  // Intro on visible dots — uses CSS vars for positioning now
  playIntro({ duration = 1000, amplitude = 60, waveSpeed = 1.3, bounces = 1.25 } = {}) {
    const dots = this.dots.slice();
    const start = performance.now();
    dots.forEach(d => {
      d.r = Math.hypot(d.ox, d.oy);
      d.introDelay = d.r / waveSpeed;
      d.introAmp = amplitude * (0.85 + Math.random() * 0.3);
      d.introDone = false;
      const dirx = d.r ? d.ox / d.r : 0, diry = d.r ? d.oy / d.r : 0;
      d.x = d.ox + dirx * d.introAmp; d.y = d.oy + diry * d.introAmp; d.vx = d.vy = 0;
      d.el.style.setProperty('--x', `${d.x}px`);
      d.el.style.setProperty('--y', `${d.y}px`);
    });

    return new Promise(resolve => {
      const step = () => {
        let allDone = true; const now = performance.now();
        for (const d of dots) {
          if (d.introDone) continue;
          const t = now - start - d.introDelay;
          if (t <= 0) { allDone = false; continue; }
          if (t >= duration) {
            d.x = d.ox; d.y = d.oy; d.vx = d.vy = 0;
            d.el.style.setProperty('--x', `${d.x}px`);
            d.el.style.setProperty('--y', `${d.y}px`);
            d.introDone = true; continue;
          }
          allDone = false;
          const p = t / duration, dec = (1 - p) * (1 - p), osc = Math.cos(p * Math.PI * 2 * bounces);
          const dirx = d.r ? d.ox / d.r : 0, diry = d.r ? d.oy / d.r : 0;
          const disp = d.introAmp * dec * osc;
          d.x = d.ox + dirx * disp; d.y = d.oy + diry * disp;
          d.el.style.setProperty('--x', `${d.x}px`);
          d.el.style.setProperty('--y', `${d.y}px`);
        }
        if (allDone) return resolve();
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
}
