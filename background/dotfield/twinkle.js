import { randInt } from './utils.js';

export class Twinkle {
  constructor({ dots, size, color, minMs, maxMs }) {
    this.dots = dots;
    this.size = size;
    this.color = color;
    this.minMs = minMs;
    this.maxMs = maxMs;
    this._boost = 1;
    this._timer = null;

    this._tick = this._tick.bind(this);
  }

  start() { this._schedule(); }
  stop()  { if (this._timer) clearTimeout(this._timer); this._timer = null; }
  setBoost(multiplier) {
    const v = Number(multiplier);
    if (Number.isFinite(v) && v > 0) this._boost = v;
  }

  _schedule() {
    const delay = randInt(this.minMs, this.maxMs) / this._boost;
    this._timer = setTimeout(this._tick, delay);
  }

  _tick() {
    if (!this.dots.length) return this._schedule();

    let chosen = null;
    for (let tries = 0; tries < 10 && !chosen; tries++) {
      const d = this.dots[Math.floor(Math.random() * this.dots.length)];
      const dx = d.x - d.ox, dy = d.y - d.oy;
      if ((dx*dx + dy*dy) < (this.size * this.size * 6)) chosen = d; // near home
    }
    chosen = chosen || this.dots[Math.floor(Math.random() * this.dots.length)];

    const el = chosen.el;
    const oldShadow = el.style.boxShadow;
    const oldBg = el.style.background;
    const oldW = el.style.width;
    const oldH = el.style.height;

    el.style.transition = 'box-shadow 420ms ease, background-color 420ms ease, width 420ms ease, height 420ms ease';
    el.style.boxShadow = '0 0 6px rgba(255,255,255,.65)';
    el.style.background = 'rgba(255,255,255,.9)';
    el.style.width = `${this.size + 1}px`;
    el.style.height = `${this.size + 1}px`;

    setTimeout(() => {
      el.style.boxShadow = oldShadow;
      el.style.background = oldBg || this.color;
      el.style.width = oldW || `${this.size}px`;
      el.style.height = oldH || `${this.size}px`;
      setTimeout(() => { el.style.transition = ''; }, 450);
    }, 420);

    this._schedule();
  }
}