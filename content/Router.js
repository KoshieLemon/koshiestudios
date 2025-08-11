// Forward sequence (async):
//   1) Zoom IN (via --scale).
//   2) Slight delay → cell fades OUT.
//   3) Slight delay → portal fades + unblurs IN and expands to full.
//   4) Mark return + navigate.
// Reverse handled in ExternalReturn.js.

const PAGES = {
  // Use the file that actually exists in your repo
  kadie: { src: '/kadie-page/kadie.html' }
};

export class Router {
  constructor(opts = {}) {
    this.cell       = opts.cell;
    this.content    = opts.content;
    this.camera     = opts.camera;

    this.active     = false;
    this.ease       = opts.ease || 'cubic-bezier(.22,1,.36,1)';
    this.dur        = Math.max(200, opts.dur || 1200);
    this.fadeDur    = Math.max(200, opts.fadeDur || 1300);

    this._boundClick = this._onClick.bind(this);
    this.mount();

    // Fix "needs full reload after back" by resetting on bfcache return
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) {
        try { this.resetAfterReturn(); } catch {}
      }
    });
  }

  getLogoBtn() {
    return new Promise((resolve) => {
      let tries = 0;
      const tick = () => {
        tries++;
        const el = document.querySelector('.brand a, .brand button, #site-header a, #site-header .brand, header .brand a');
        if (el || tries > 60) return resolve(el || null);
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  mount() {
    if (!this.cell) return;
    this.cell.removeEventListener('click', this._boundClick);
    this.cell.addEventListener('click', this._boundClick);
  }

  resetAfterReturn() {
    this.active = false;
    this._destroyPortal();
    if (this.cell) {
      this.cell.style.pointerEvents = 'auto';
      this.cell.style.opacity = '1';
      this.cell.style.transform = 'scale(1)';
    }
    if (this.camera) {
      this.camera.style.setProperty('--scale', '1');
      this.camera.style.setProperty('--zoom-dur', '0ms');
    }
  }

  _onClick(e) {
    e.preventDefault();
    const key = this.cell?.dataset?.page;
    if (!key) return;
    this._open(key);
  }

  _open(key) {
    if (this.active) return;
    const page = PAGES[key];
    if (!page) return;
    this.active = true;

    // Reset any leftovers
    this._destroyPortal();
    this.cell.style.pointerEvents = 'none';

    // (1) Zoom IN
    this.camera.style.setProperty('--zoom-dur', `${this.dur}ms`);
    this.camera.style.setProperty('--ease', this.ease);
    this.camera.style.setProperty('--scale', '1.08');

    // (2) Cell fade OUT (slight delay)
    const cellDelay = Math.round(this.dur * 0.15);
    setTimeout(() => this._fadeCellOut(true), cellDelay);

    // (3) Build portal at cell position → fade/unblur/expand in (slight delay)
    const portal = this._makePortal(page);
    const portalDelay = Math.round(this.dur * 0.33);
    requestAnimationFrame(() => {
      setTimeout(() => {
        portal.style.opacity   = '1';
        portal.style.filter    = 'none';
        portal.style.transform = 'translate(0px, 0px) scale(1, 1)';
      }, portalDelay);
    });

    // Prevent intro replay in this tab while leaving
    try { sessionStorage.setItem('skipIntro', '1'); } catch {}

    // Allow cancel (brand click) before navigation
    this._wireCancelUntilNavigate();

    // (4) Mark + navigate near end
    setTimeout(() => {
      try {
        localStorage.setItem('koshie:return', JSON.stringify({
          cell: key, url: page.src, t: Date.now(), ttl: 6 * 60 * 60 * 1000
        }));
        sessionStorage.setItem('skipIntro', '1');
      } catch {}
      location.assign(page.src);
    }, this.fadeDur - 10);
  }

  _wireCancelUntilNavigate() {
    this.getLogoBtn().then((btn) => {
      if (!btn) return;
      const onClick = (ev) => {
        ev.preventDefault();
        this._closeInPlace();
        btn.removeEventListener('click', onClick);
      };
      btn.addEventListener('click', onClick);
    }).catch(() => {});
  }

  _makePortal(page) {
    this._destroyPortal();

    const rect = this.cell.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const sx = rect.width / vw, sy = rect.height / vh;
    const tx = rect.left,       ty = rect.top;

    // shell
    const portal = document.createElement('div');
    portal.className = 'portal';
    portal.style.cssText = [
      'position:fixed','inset:0','z-index:999','background:#0b0b10',
      `transition: transform ${this.fadeDur}ms ${this.ease}, opacity ${this.fadeDur}ms ${this.ease}, filter ${Math.max(200, Math.floor(this.fadeDur*0.35))}ms ${this.ease}`,
      `transform: translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`,
      'opacity:0','filter:brightness(.85) blur(12px)'
    ].join(';');

    // frame
    const frame = document.createElement('iframe');
    frame.src = page.src;
    frame.setAttribute('loading','eager');
    frame.style.cssText = 'width:100%;height:100%;border:0;display:block';
    portal.appendChild(frame);
    document.body.appendChild(portal);

    this.portal = portal;
    return portal;
  }

  _closeInPlace() {
    if (!this.portal) {
      this.camera.style.setProperty('--scale', '1');
      this._fadeCellOut(false);
      this.cell.style.pointerEvents = 'auto';
      this.active = false;
      return;
    }

    const rect = this.cell.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const sx = rect.width / vw, sy = rect.height / vh;
    const tx = rect.left,       ty = rect.top;

    const portal = this.portal;
    portal.style.transform = `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`;
    portal.style.opacity   = '0';
    portal.style.filter    = 'brightness(.85) blur(12px)';

    this.camera.style.setProperty('--scale', '1');
    this._fadeCellOut(false);

    setTimeout(() => {
      this._destroyPortal();
      this.cell.style.pointerEvents = 'auto';
      this.active = false;
    }, this.fadeDur + 50);
  }

  _destroyPortal() {
    if (this.portal && this.portal.parentNode) this.portal.parentNode.removeChild(this.portal);
    this.portal = null;
  }

  _fadeCellOut(out) {
    this.cell.style.transition = `opacity ${this.fadeDur}ms ${this.ease}, transform ${this.fadeDur}ms ${this.ease}`;
    this.cell.style.opacity = out ? '0' : '1';
    this.cell.style.transform = out ? 'scale(0.98)' : 'scale(1)';
  }
}

export default Router;