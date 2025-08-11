import { easeInOutCubic } from './ease.js';

export class EdgeMaskAnimator {
  constructor(el) {
    this.el = el;   // content element
    this._raf = null;
  }

  animate({ from, to, ms }) {
    this.cancel();
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      const k = easeInOutCubic(t);
      const v = from + (to - from) * k;
      this.el.style.setProperty('--edge-size', `${v}%`);
      if (t < 1) {
        this._raf = requestAnimationFrame(step);
      } else {
        this._raf = null;
        this.el.style.setProperty('--edge-size', `${to}%`);
      }
    };
    this._raf = requestAnimationFrame(step);
  }

  cancel() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }
}
