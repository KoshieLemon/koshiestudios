// ReturnManager: persist "we left via this cell/url" and, on load, auto-play the
// reverse collapse from that cell without any extra back press or hash juggling.

export const ReturnManager = {
  key: 'koshie:return',

  setOutbound({ cell, url, ttlMs = 6 * 60 * 60 * 1000 }) {
    try {
      const rec = { cell, url, t: Date.now(), ttl: ttlMs };
      localStorage.setItem(this.key, JSON.stringify(rec));
      // Make sure intro won’t run on the immediate return
      sessionStorage.setItem('skipIntro', '1');
    } catch {}
  },

  /**
   * On load, if there’s an outbound record and it isn’t stale,
   * build a full-screen portal for that URL and collapse it into the target cell.
   * Returns a Promise<boolean> which resolves true if a return animation ran.
   */
  async checkOnLoad({ camera, cellSelector = '.grid .cell[data-page="kadie"]', ease = 'cubic-bezier(.22,1,.36,1)', dur = 3500 } = {}) {
    let rec = null;
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) rec = JSON.parse(raw);
    } catch {}

    if (!rec) return false;
    if (rec.ttl && Date.now() - rec.t > rec.ttl) {
      try { localStorage.removeItem(this.key); } catch {}
      return false;
    }

    const cell = document.querySelector(cellSelector);
    if (!camera || !cell) return false;

    // Prevent intro during this run
    try { sessionStorage.setItem('skipIntro', '1'); } catch {}

    // Build return portal (full screen → collapse to cell)
    const el = document.createElement('div');
    el.className = 'portal return';
    el.style.transformOrigin = '0 0';
    el.style.position = 'fixed';
    el.style.left = '0'; el.style.top = '0';
    el.style.width = '100vw'; el.style.height = '100vh';
    el.style.zIndex = '1000';
    el.style.background = '#0f1110';
    el.style.willChange = 'transform, opacity';
    el.style.transform = 'translate(0px, 0px) scale(1, 1)';
    el.style.transition = `transform ${dur}ms ${ease}, opacity ${dur}ms ${ease}`;
    el.style.opacity = '1';

    const iframe = document.createElement('iframe');
    iframe.className = 'portal-frame';
    iframe.allow = 'fullscreen *; autoplay *; clipboard-read; clipboard-write';
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    iframe.src = rec.url;
    iframe.style.pointerEvents = 'none'; // visual only

    el.appendChild(iframe);
    document.body.appendChild(el);

    // Ensure camera is not zoomed
    camera.classList.remove('zoom');
    camera.style.setProperty('--zoom-dur', `${dur}ms`);
    camera.style.setProperty('--ease', ease);

    // Collapse to the cell
    const r = cell.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const sx = r.width  / vw;
    const sy = r.height / vh;
    const tx = r.left;
    const ty = r.top;

    requestAnimationFrame(() => {
      el.style.transform = `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`;
      el.style.opacity = '0';
    });

    await new Promise(resolve => {
      const onEnd = () => { el.removeEventListener('transitionend', onEnd); resolve(); };
      el.addEventListener('transitionend', onEnd);
    });

    el.remove();
    try { localStorage.removeItem(this.key); } catch {}

    return true;
  }
};

export default ReturnManager;
