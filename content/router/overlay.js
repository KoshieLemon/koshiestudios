import { EdgeMaskAnimator } from './edgeMask.js';

export class Overlay {
  constructor(el) {
    this.el = el; // #content
    this.edge = new EdgeMaskAnimator(el);
  }

  get elContent() { return this.el; }

  prepareAt({ cx, cy, initialScale, edgeSize, blurPx, brightness, src }) {
    this.el.innerHTML = `<iframe src="${src}" class="page-frame"></iframe>`;

    // origin + start scale
    this.el.style.setProperty('--content-origin-x', `${cx}px`);
    this.el.style.setProperty('--content-origin-y', `${cy}px`);
    this.el.style.setProperty('--content-scale', String(initialScale));

    // start effects
    this.el.style.setProperty('--edge-size', `${edgeSize}%`);
    this.el.style.setProperty('--content-blur', `${blurPx}px`);
    this.el.style.setProperty('--content-brightness', String(brightness));

    // flush
    // eslint-disable-next-line no-unused-expressions
    this.el.offsetWidth;
  }

  enter(ms) {
    // fade/zoom in + clear effects
    this.el.classList.add('visible');
    requestAnimationFrame(() => {
      this.el.style.setProperty('--content-scale', '1');
      this.el.style.setProperty('--content-blur', '0px');
      this.el.style.setProperty('--content-brightness', '1');
      this.edge.animate({ from: parseFloat(this._get('--edge-size')) || 0, to: 0, ms });
    });
  }

  exit(ms, { initialScale, edgeSize, cx, cy }) {
    // ensure origin in case of resize
    this.el.style.setProperty('--content-origin-x', `${cx}px`);
    this.el.style.setProperty('--content-origin-y', `${cy}px`);

    // zoom/fade out + bring back effects
    this.el.style.setProperty('--content-scale', String(initialScale));
    this.el.classList.remove('visible');
    this.el.style.setProperty('--content-blur', '10px');
    this.el.style.setProperty('--content-brightness', '0.78');
    this.edge.animate({ from: 0, to: edgeSize, ms });
  }

  clear() {
    this.edge.cancel();
    this.el.innerHTML = '';
    // reset tokens to safe defaults
    this.el.style.setProperty('--edge-size', '0%');
    this.el.style.setProperty('--content-blur', '0px');
    this.el.style.setProperty('--content-brightness', '1');
  }

  _get(name) {
    return getComputedStyle(this.el).getPropertyValue(name).trim();
  }
}
