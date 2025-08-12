// main.js — force a full reload on back/forward so the page NEVER restores from BFCache.
// This makes coming back behave exactly like loading http://localhost:8099/ (your “works every time” path).

import { qs } from './core/dom.js';

// 1) side-effect import (no named exports from header.js)
import './header/header.js';

// 2) provide a local headerReady Promise for the await below
const headerReady = new Promise((resolve) => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', resolve, { once: true });
  } else {
    resolve();
  }
});

import { CanvasController } from './canvas/CanvasController.js';
import { DragController } from './drag/DragController.js';
import { Router } from './content/Router.js';
import { Devtools } from './debug/Devtools.js';
import { DotField } from './background/DotField.js';
import Tooltip from './ui/Tooltip.js';
import { handleExternalReturn } from './content/ExternalReturn.js'; // kept, but back/forward will hard-reload now

// Surface silent errors during dev
window.onerror = (m, s, l, c, e) => console.error('[window.onerror]', m, s, l, c, e);
window.onunhandledrejection = (ev) => console.error('[unhandledrejection]', ev.reason || ev);

// 🔒 Disable BFCache in most browsers & hard-reload on back/forward as a fallback
// 1) An unload listener makes the page ineligible for BFCache on Chrome/Safari (best effort)
window.addEventListener('unload', () => { /* no-op: intentionally present to disable BFCache */ });
// 2) If a restore still happens (some engines), detect it and do a one-time reload
window.addEventListener('pageshow', (e) => {
  const nav = performance.getEntriesByType?.('navigation')?.[0];
  const isBF = e.persisted || (nav && nav.type === 'back_forward');
  if (isBF) {
    const key = 'ks:bf-reloaded';
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      location.reload(); // full fresh load == consistent working path
    } else {
      sessionStorage.removeItem(key);
    }
  }
});

window.addEventListener('DOMContentLoaded', async () => {
  const viewport  = qs('.viewport');
  const camera    = qs('.camera');
  const wrapper   = qs('.grid-wrapper');
  const content   = document.getElementById('content');
  const kadieCell = document.querySelector('.cell[data-page="kadie"]');

  if (!viewport || !camera || !wrapper || !kadieCell || !content) {
    console.error('Missing required DOM nodes');
    return;
  }

  // Universal pan/scale controller
  const canvas = new CanvasController({ camera, wrapper, viewport });

  // Drag with resistance + smoothed follow + synced bg/grid
  const drag = new DragController({ viewport, canvas });

  // Procedural background dots (virtualized), spacing-only zoom via CSS inverse scale
  const dots = new DotField({
    camera,
    viewport,
    spacing: 56,
    size: 2,
    color: 'rgba(255,255,255,.28)'
  });

  // Router -> only Kadie cell is wired as interactive
  const router = new Router({
    cell: kadieCell,
    content, camera, canvas,
    getLogoBtn: async () => await headerReady
  });
  router.dur = 1200;     // keep your faster timings
  router.fadeDur = 1200;
  router.mount();

  // Tooltip for disabled placeholders
  const placeholders = document.querySelectorAll('.cell.disabled');
  const tip = new Tooltip('This item is not yet available');
  tip.attachAll(placeholders);

  // Devtools (optional)
  const dt = new Devtools({ canvas, drag, camera, wrapper });

  // Expose for console pokes
  window.canvas = canvas;
  window.drag = drag;
  window.router = router;
  window.devtools = dt;
  window.dots = dots;

  await headerReady;

  // NOTE: We keep this call for normal loads (not BFCache restores). If BFCache happens,
  // the pageshow handler above will reload before this runs.
  handleExternalReturn({
    camera,
    cellSelector: '.grid .cell[data-page="kadie"]',
    ease: 'cubic-bezier(.22,1,.36,1)',
    dur: 1200
  });

  console.log('[boot] app mounted');
});
