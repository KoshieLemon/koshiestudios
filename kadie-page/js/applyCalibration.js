// Apply saved eye/hair calibration on page load with auto-heal
const KEY = 'kadieEyeConfig';

(function () {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySaved, { once: true });
  } else {
    applySaved();
  }
})();

function applySaved() {
  const wrap = document.getElementById('kadieWrap') || document.querySelector('.kadie-wrap');
  if (!wrap) return;

  const def = {
    left:  { x: 41.5, y: 41.2, w: 21.0 },
    right: { x: 58.5, y: 41.2, w: 21.0 },
    h1:    { x: 36.0, y: 54.0, w: 36.0 },
    h2:    { x: 64.0, y: 54.0, w: 36.0 },
  };

  let cfg = load() || {};
  cfg = {
    left:  sanitize(cfg.left,  5, 80, def.left),
    right: sanitize(cfg.right, 5, 80, def.right),
    h1:    sanitize(cfg.h1,    8, 80, def.h1),
    h2:    sanitize(cfg.h2,    8, 80, def.h2),
  };

  // Apply to CSS variables
  set('--eyeL-left',  cfg.left.x);  set('--eyeL-top',  cfg.left.y);  set('--eyeL-width',  cfg.left.w);
  set('--eyeR-left',  cfg.right.x); set('--eyeR-top', cfg.right.y);  set('--eyeR-width',  cfg.right.w);
  set('--hair1-left', cfg.h1.x);    set('--hair1-top', cfg.h1.y);    set('--hair1-width', cfg.h1.w);
  set('--hair2-left', cfg.h2.x);    set('--hair2-top', cfg.h2.y);    set('--hair2-width', cfg.h2.w);

  // Auto-heal: if computed hair width is basically zero, restore defaults & persist
  const hair1 = document.getElementById('kadieHair01') || document.querySelector('.hair-01');
  const hair2 = document.getElementById('kadieHair02') || document.querySelector('.hair-02');

  // Give the browser a tick to compute styles
  requestAnimationFrame(() => {
    const w1px = pxWidth(hair1);
    const w2px = pxWidth(hair2);
    const invalid = (v) => !Number.isFinite(v) || v < 6;

    if (invalid(w1px) || invalid(w2px)) {
      console.warn('[applyCalibration] Detected suppressed hair width; restoring defaults.');
      // Restore default hair only (do not touch eyes)
      set('--hair1-left', def.h1.x);  set('--hair1-top', def.h1.y);  set('--hair1-width', def.h1.w);
      set('--hair2-left', def.h2.x);  set('--hair2-top', def.h2.y);  set('--hair2-width', def.h2.w);
      cfg.h1 = { ...def.h1 }; cfg.h2 = { ...def.h2 };
      save(cfg);
    } else {
      // Save sanitized config back so old bad values get fixed permanently
      save(cfg);
    }

    // Quick 900ms outline so you can *see* where hair landed
    [hair1, hair2].forEach(el => {
      if (!el) return;
      el.style.outline = '2px dashed rgba(255,255,255,.65)';
      setTimeout(() => { el.style.outline = 'none'; }, 900);
      // Ensure nothing is suppressing visibility
      el.style.opacity = '1';
      el.style.mixBlendMode = 'normal';
      el.style.filter = 'none';
      el.style.pointerEvents = 'none';
      el.style.zIndex = String(8060);
    });
  });

  function set(name, val) {
    wrap.style.setProperty(name, (typeof val === 'number') ? (val + '%') : val);
  }
}

function sanitize(obj, minW, maxW, fallback) {
  if (!obj || !isFinite(obj.x) || !isFinite(obj.y) || !isFinite(obj.w)) return { ...fallback };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  return {
    x: clamp(+obj.x, 0, 100),
    y: clamp(+obj.y, 0, 100),
    w: clamp(+obj.w, minW, maxW),
  };
}

function pxWidth(el) {
  if (!el) return NaN;
  const cs = getComputedStyle(el);
  return parseFloat(cs.width);
}

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}
function save(cfg) {
  try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {}
}
