// /kadie-page/js/patches/messageSpawnRemap.js
// Goal: Stretch the spawn space horizontally on BOTH sides without resizing cards.
// We do this by remapping each card's original "left" into a virtual width
//   V = viewportWidth + 2*EXTRA
// then setting element.style.left to the remapped value.
// No scaling, no container width changes -> shapes stay intact.

(() => {
  // Extra pixels added on EACH side (change if you want more space)
  const EXTRA = 400; // px per side

  // Only immediate children of .message-layer are treated as spawnable cards
  const LAYERS_SEL = '.scene .message-layer';

  // --- helpers ---
  const px = v => (typeof v === 'number' && Number.isFinite(v)) ? v : 0;
  const parsePx = (s) => {
    if (!s || s === 'auto') return 0;
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  };

  // We store each element's normalized original X (0..1) so we can remap on resize
  function stashOriginalLeft(el, layerWidth) {
    if (el.dataset.spawnLNorm) return; // already stashed
    const cs = getComputedStyle(el);
    const left0 = parsePx(cs.left);
    const w = px(layerWidth) || px(window.innerWidth);
    const norm = w > 0 ? Math.min(Math.max(left0 / w, 0), 1) : 0;
    el.dataset.spawnL0 = String(left0);
    el.dataset.spawnLNorm = String(norm);
  }

  function remapLeft(el, viewportW) {
    // Require a stashed normalized value; if missing, try to create it now
    if (!el.dataset.spawnLNorm) {
      const layer = el.closest(LAYERS_SEL);
      const layerW = layer ? layer.getBoundingClientRect().width : viewportW;
      stashOriginalLeft(el, layerW);
    }
    const norm = Number(el.dataset.spawnLNorm);
    if (!Number.isFinite(norm)) return;

    const V = viewportW + 2 * EXTRA;          // virtual width
    const left0 = Number(el.dataset.spawnL0) || 0;
    const newLeft = -EXTRA + norm * V;        // remapped left in px
    if (Number.isFinite(newLeft)) {
      // Set left directly; do not touch width/transform -> no shape distortion.
      el.style.left = `${newLeft}px`;
      // Let cards freely overflow outside; never clip to the layer box.
      el.style.maxWidth = 'none';
    }
  }

  function remapAllInLayer(layer) {
    const viewportW = window.innerWidth || document.documentElement.clientWidth || 1920;
    // Only immediate children; avoids touching backing videos/overlays elsewhere
    Array.from(layer.children).forEach(child => {
      if (child.nodeType !== 1) return;
      const cs = getComputedStyle(child);
      if (cs.position !== 'absolute' && cs.position !== 'fixed') return;
      stashOriginalLeft(child, layer.getBoundingClientRect().width);
      remapLeft(child, viewportW);
    });
  }

  function remapAll() {
    document.querySelectorAll(LAYERS_SEL).forEach(remapAllInLayer);
  }

  // Observe new cards added by the generator and remap them as they appear
  function observe() {
    const scene = document.getElementById('scene');
    if (!scene) return;
    const mo = new MutationObserver(muts => {
      let needs = false;
      for (const m of muts) {
        if (m.type === 'childList' && (m.addedNodes && m.addedNodes.length)) {
          needs = true;
          // Fast-path: handle newly added nodes in message layers immediately
          if (m.target && (m.target.matches && m.target.matches(LAYERS_SEL))) {
            remapAllInLayer(m.target);
          }
        }
      }
      if (needs) {
        // Schedule a follow-up pass to catch nested creations
        requestAnimationFrame(remapAll);
      }
    });
    mo.observe(scene, { childList: true, subtree: true });
  }

  function init() {
    // Let layers overflow so cards can live outside the viewport edges
    document.querySelectorAll(LAYERS_SEL).forEach(l => {
      l.style.overflow = 'visible';
    });

    remapAll();
    observe();

    // Keep mapping consistent with viewport changes
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(remapAll);
    };
    window.addEventListener('resize', onResize);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
