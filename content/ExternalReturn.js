// Reverse sequence (robust, multi-cycle safe, with console debug):
//   - Reuse BFCache portal if present (ONLY ONE portal).
//   - Camera animates OUT (set --scale back to 1).
//   - Button fades IN and is clickable at the end.
//   - All portals removed after transition (with hard fallbacks).
//   - Return marker cleared immediately.
//   - Inline state reset so the NEXT cycle is pristine.
//   - Verbose console logging so you can see exactly what happens.

export function handleExternalReturn({
  camera,
  cellSelector = '.grid .cell[data-page="kadie"]',
  ease = 'cubic-bezier(.22,1,.36,1)',
  dur = 1200
} = {}) {
  return new Promise(async (resolve) => {
    const T0 = performance.now();
    const log = (...a) => console.log('[ExternalReturn]', ...a);

    const cell = document.querySelector(cellSelector);
    let portals = Array.from(document.querySelectorAll('.portal'));
    const rec = safeReadReturn();
    const shouldRun = !!rec || portals.length > 0;

    log('start', { portals: portals.length, hasMarker: !!rec, hasCamera: !!camera, hasCell: !!cell });

    if (!camera || !cell || !shouldRun) {
      log('bail', { shouldRun, hasCamera: !!camera, hasCell: !!cell });
      return resolve(false);
    }

    // Clear the return marker immediately so we never loop
    try { localStorage.removeItem('koshie:return'); } catch {}

    // Prepare button (will fade back under the portal)
    cell.style.transition = `opacity ${dur}ms ${ease}, transform ${dur}ms ${ease}`;
    cell.style.opacity = '0';
    cell.style.transform = 'scale(0.98)';
    cell.style.pointerEvents = 'none';

    // Camera: animate OUT by restoring --scale to 1
    camera.style.setProperty('--zoom-dur', `${dur}ms`);
    camera.style.setProperty('--ease', ease);
    requestAnimationFrame(() => camera.style.setProperty('--scale', '1'));

    // Re-measure target geometry; if layout isn't ready (width 0), wait a tick
    let rect = cell.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      log('target pending layout -> waiting RAF');
      await nextFrame(); await nextFrame();
      rect = cell.getBoundingClientRect();
    }

    const vw = window.innerWidth, vh = window.innerHeight;
    const sx = rect.width / vw, sy = rect.height / vh;
    const tx = rect.left,       ty = rect.top;
    log('target', { tx, ty, sx: +sx.toFixed(4), sy: +sy.toFixed(4) });

    const cleanup = (why = 'transitionend') => {
      log('cleanup', { why, t: Math.round(performance.now() - T0) + 'ms' });
      // Button visible & clickable
      cell.style.opacity = '1';
      cell.style.transform = 'scale(1)';
      setTimeout(() => { cell.style.pointerEvents = 'auto'; }, Math.max(80, Math.floor(dur * 0.85)));
      // Remove ALL portals
      document.querySelectorAll('.portal').forEach(p => p.remove());
      // Reset inline state we touched so next forward/back starts fresh
      try {
        cell.style.removeProperty('transition');
        cell.style.removeProperty('transform');
        cell.style.removeProperty('opacity');
        cell.style.removeProperty('pointer-events');
        camera.style.removeProperty('--zoom-dur');
        camera.style.removeProperty('--ease');
        camera.style.removeProperty('--scale');
      } catch {}
      resolve(true);
    };

    // ───────────────────────── Reuse BFCache portal if present ─────────────────────────
    if (portals.length) {
      // Keep only the topmost portal; nuke extras
      const el = portals[portals.length - 1];
      portals.forEach(p => { if (p !== el) p.remove(); });

      // Ensure fixed fullscreen baseline; no click blocking
      Object.assign(el.style, {
        position: 'fixed',
        left: '0px', top: '0px',
        width: '100vw', height: '100vh',
        zIndex: '1000',
        pointerEvents: 'none',
        transformOrigin: '0 0',
        backfaceVisibility: 'hidden',
        willChange: 'transform, opacity'
      });

      // SNAP to start (no transition), commit with reflow + computed read
      el.style.transition = 'none';
      el.style.display = '';
      el.classList.add('return');
      el.style.opacity = '1';
      el.style.transform = 'translate3d(0px, 0px, 0) scale(1, 1)';

      void el.offsetWidth;
      window.getComputedStyle(el).transform;

      // Enable transition and set end state after a double-RAF
      el.style.transition = `transform ${dur}ms ${ease}, opacity ${dur}ms ${ease}`;
      await nextFrame(); await nextFrame();

      log('shrink(reuse) ->', { tx, ty, sx: +sx.toFixed(4), sy: +sy.toFixed(4) });
      el.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${sx}, ${sy})`;
      el.style.opacity = '0';

      // If transform doesn't change, drive it manually as a fallback
      manualFallbackIfStalled(el, { tx, ty, sx, sy, dur, ease, tag: 'reuse' });

      // Cleanup with robust fallback
      let done = false;
      const finish = (evt) => { if (done) return; done = true; el.removeEventListener('transitionend', finish); cleanup(evt?.type || 'fallback'); };
      el.addEventListener('transitionend', finish, { once: true });
      setTimeout(finish, dur + 320);
      return;
    }

    // ───────────────────── Otherwise create a single ephemeral overlay ────────────────────
    const url = rec?.url || '';
    const el = document.createElement('div');
    el.className = 'portal return';
    Object.assign(el.style, {
      position: 'fixed',
      left: '0', top: '0',
      width: '100vw', height: '100vh',
      transformOrigin: '0 0',
      transform: 'translate3d(0px, 0px, 0) scale(1, 1)',
      opacity: '1',
      zIndex: '1000',
      pointerEvents: 'none',
      transition: `transform ${dur}ms ${ease}, opacity ${dur}ms ${ease}`,
      backfaceVisibility: 'hidden',
      willChange: 'transform, opacity'
    });

    if (url) {
      const iframe = document.createElement('iframe');
      iframe.className = 'page-frame';
      iframe.src = url;
      iframe.setAttribute('loading', 'eager');
      iframe.setAttribute('referrerpolicy', 'no-referrer');
      Object.assign(iframe.style, { border: '0', width: '100%', height: '100%' });
      el.appendChild(iframe);
    }

    document.body.appendChild(el);

    // Commit start → animate end (double-RAF)
    void el.offsetWidth;
    window.getComputedStyle(el).transform;
    await nextFrame(); await nextFrame();

    log('shrink(new) ->', { tx, ty, sx: +sx.toFixed(4), sy: +sy.toFixed(4) });
    el.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${sx}, ${sy})`;
    el.style.opacity = '0';

    manualFallbackIfStalled(el, { tx, ty, sx, sy, dur, ease, tag: 'new' });

    let done = false;
    const finish = (evt) => { if (done) return; done = true; el.removeEventListener('transitionend', finish); cleanup(evt?.type || 'fallback'); };
    el.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, dur + 320);
  });
}

/* ============================== helpers ============================== */

function safeReadReturn() {
  try {
    const raw = localStorage.getItem('koshie:return');
    if (!raw) return null;
    const rec = JSON.parse(raw);
    const fresh = !rec.ttl || (Date.now() - (rec.t || 0)) < rec.ttl;
    return fresh ? rec : null;
  } catch { return null; }
}

function nextFrame() {
  return new Promise(r => requestAnimationFrame(() => r()));
}

// If after ~120ms the element hasn't started moving, tween it manually with JS so it never sticks.
function manualFallbackIfStalled(el, { tx, ty, sx, sy, dur, tag }) {
  const log = (...a) => console.log('[ExternalReturn]', ...a);
  const checkDelay = 140;
  const startMatrix = getComputedStyle(el).transform;
  setTimeout(() => {
    const nowMatrix = getComputedStyle(el).transform;
    if (nowMatrix === startMatrix) {
      log('fallback/manual', { tag, reason: 'transform unchanged after checkDelay', checkDelay });
      const t0 = performance.now();
      const start = { x: 0, y: 0, sx: 1, sy: 1 };
      function tick() {
        const t = Math.min(1, (performance.now() - t0) / dur);
        const easeT = cubicBezier22_1_36_1(t); // roughly matches ease
        const x = start.x + (tx - start.x) * easeT;
        const y = start.y + (ty - start.y) * easeT;
        const scx = start.sx + (sx - start.sx) * easeT;
        const scy = start.sy + (sy - start.sy) * easeT;
        el.style.transition = 'none';
        el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scx}, ${scy})`;
        el.style.opacity = String(1 - easeT);
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    } else {
      log('fallback/manual not needed', { tag });
    }
  }, checkDelay);
}

// Approximation of cubic-bezier(.22,1,.36,1)
function cubicBezier22_1_36_1(t) {
  // Use a quick easeOutQuint-ish approximation for performance; good enough for fallback visuals
  return 1 - Math.pow(1 - t, 5);
}

export default handleExternalReturn;
