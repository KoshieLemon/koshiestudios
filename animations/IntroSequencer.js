// Plays the home intro (dots wave, cells drop, header slides) unless skipIntro is set.
// We DO NOT auto-run here; call .play() from main.js after return-check.

export class IntroSequencer {
  constructor({ dots, headerSelector = '.site-header', cellsSelector = '.grid .cell', viewportSelector = '.viewport' } = {}) {
    if (!dots) throw new Error('[IntroSequencer] requires a DotField instance');
    this.dots = dots;
    this.header = document.querySelector(headerSelector);
    this.cells = Array.from(document.querySelectorAll(cellsSelector));
    this.viewport = document.querySelector(viewportSelector);
    this._stylesInjected = false;
  }

  async play() {
    try { if (sessionStorage.getItem('skipIntro') === '1') return; } catch {}
    this._injectStyles();

    const vp = this.viewport;
    const oldPE = vp?.style.pointerEvents;
    if (vp) vp.style.pointerEvents = 'none';

    try {
      const dotsP = this.dots.playIntro({ duration: 1100, amplitude: 64, waveSpeed: 1.4, bounces: 1.35 });

      // Cells stagger by distance to center
      const camRect = document.querySelector('.camera')?.getBoundingClientRect();
      const cx = camRect ? camRect.left + camRect.width / 2 : window.innerWidth / 2;
      const cy = camRect ? camRect.top  + camRect.height / 2 : window.innerHeight / 2;

      const baseDelay = 200;
      const delayPerPx = 0.45;
      this.cells.forEach((el) => {
        const r = el.getBoundingClientRect();
        const ex = r.left + r.width / 2;
        const ey = r.top  + r.height / 2;
        const dist = Math.hypot(ex - cx, ey - cy);
        const delay = Math.round(baseDelay + dist * delayPerPx);

        el.classList.add('intro-cell');
        el.style.animationDelay = `${delay}ms`;
        el.style.animationDuration = `900ms`;
        el.style.animationFillMode = 'both';
        el.style.animationTimingFunction = 'cubic-bezier(.22,1,.36,1)';
        el.style.animationName = 'introCellFall';
      });

      if (this.header) {
        this.header.classList.add('intro-header-hidden');
        requestAnimationFrame(() => this.header.classList.add('intro-header-in'));
      }

      const timeout = new Promise(r => setTimeout(r, 2200));
      await Promise.race([dotsP.catch(() => {}), timeout]);
      await new Promise(r => setTimeout(r, 150));
    } finally {
      if (vp) vp.style.pointerEvents = oldPE || '';
      this.cells.forEach(el => { el.style.animation = ''; el.classList.remove('intro-cell'); });
      if (this.header) this.header.classList.remove('intro-header-hidden', 'intro-header-in');
    }
  }

  _injectStyles() {
    if (this._stylesInjected) return;
    const id = 'intro-sequencer-styles';
    if (document.getElementById(id)) { this._stylesInjected = true; return; }

    const css = `
      @keyframes introCellFall {
        0%   { transform: translateY(-52vh) scale(1.04); opacity: 0; }
        60%  { transform: translateY(12px)  scale(1.00); opacity: 1; }
        78%  { transform: translateY(-6px)  scale(1.00); }
        100% { transform: translateY(0)     scale(1.00); opacity: 1; }
      }
      .intro-header-hidden {
        will-change: transform, filter, opacity;
        transform: translateY(-22px);
        filter: blur(10px);
        opacity: 0;
      }
      .intro-header-in {
        animation: introHeaderIn 880ms cubic-bezier(.22,1,.36,1) both 180ms;
      }
      @keyframes introHeaderIn {
        0%   { transform: translateY(-22px); filter: blur(10px); opacity: 0; }
        60%  { transform: translateY(2px);   filter: blur(2px);  opacity: .95; }
        100% { transform: translateY(0);     filter: blur(0);    opacity: 1; }
      }
    `;

    const tag = document.createElement('style');
    tag.id = id;
    tag.textContent = css;
    document.head.appendChild(tag);
    this._stylesInjected = true;
  }
}

export default IntroSequencer;