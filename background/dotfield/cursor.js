// Custom cursor: always on top, exact 1:1 tracking,
// and native cursor hidden in ALL states (pointer, text, resize, etc.).

export class Cursor {
  constructor(cfg) {
    this.cfg = cfg;

    // Force-hide the native cursor everywhere in the document.
    let hide = document.getElementById('df-hide-native-cursor');
    if (!hide) {
      hide = document.createElement('style');
      hide.id = 'df-hide-native-cursor';
      hide.textContent = `html, body, * { cursor: none !important; }`;
      document.head.appendChild(hide);
    }

    // Cursor element (always top-most)
    const c = document.createElement('div');
    const s = c.style;
    s.position = 'fixed';
    s.left = '0';
    s.top  = '0';
    s.width  = `${cfg.size}px`;
    s.height = `${cfg.size}px`;
    s.marginLeft = `${-cfg.size/2}px`;
    s.marginTop  = `${-cfg.size/2}px`;
    s.pointerEvents = 'none';
    s.zIndex = String(Math.max(cfg.zIndex || 0, 2147483647));
    s.boxSizing = 'border-box';
    s.border = cfg.border;
    s.borderRadius = '50%';
    s.background = cfg.bg;
    s.mixBlendMode = 'screen';
    s.willChange = 'transform';
    s.transition = 'opacity .08s ease, box-shadow .12s ease, border-color .12s ease';
    s.opacity = '0';
    c.classList.add('bg-cursor');
    document.body.appendChild(c);
    this.el = c;

    // "Hot" (hovering clickable) style. Never touch transform here.
    const id = 'dotfield-cursor-style';
    let style = document.getElementById(id);
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      document.head.appendChild(style);
    }
    style.textContent = `
      .bg-cursor.hot {
        border-color: ${cfg.hotBorder} !important;
        box-shadow: ${cfg.hotGlow} !important;
      }
    `;
  }

  // Pixel-perfect follow
  move(clientX, clientY) {
    this.el.style.opacity = '1';
    this.el.style.transform = `translate3d(${clientX}px, ${clientY}px, 0)`;
  }

  setHot(isHot) { this.el.classList.toggle('hot', !!isHot); }

  hide() { this.el.style.opacity = '0'; }

  destroy() { this.el?.remove(); }
}
