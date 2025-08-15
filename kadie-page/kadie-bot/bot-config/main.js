// main.js — bootstrap + CSS fixes for sidebar and Unsaved bar (highlight/animation)
// + robust canvas DnD shim that works only when a system is selected

import { state, setGuild, setEditorEnabled } from './state.js';
import { renderHeader } from './ui-header.js';
import { refreshSystems } from './ui-systems.js';
import { loadElementsSidebar } from './ui-elements.js';
import { renderAll, addNodeFromElement } from './canvas/index.js';
import { getJSON, params, log } from './config.js';

function injectCSS(){
  const id = 'kadie-runtime-fixes';
  if (document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = `
    /* Elements sidebar: scroll, no stretch */
    #elements, .elements-pane, [data-pane="elements"], [data-role="elements-pane"], aside.elements {
      overflow-y: auto !important;
      overscroll-behavior: contain;
      max-height: calc(100vh - 140px);
      contain: layout paint;
    }
    /* Collapsible bodies fully collapse (no peek) */
    #elements .acc-body, .collapsible .collapsible__body, [data-collapsible] [data-collapsible-body]{
      overflow: hidden;
      transition: max-height 200ms ease, padding 200ms ease, margin 200ms ease;
    }
    [data-open="false"] .acc-body,
    [data-collapsible][aria-expanded="false"] [data-collapsible-body] {
      max-height: 0 !important;
      padding-top: 0 !important; padding-bottom: 0 !important;
      margin-top: 0 !important;  margin-bottom: 0 !important;
    }
    /* Unsaved bar highlight + pop animation */
    #unsavedBar, .unsaved-bar {
      position: fixed;
      left: 50%; bottom: 16px;
      transform: translate(-50%, 120%);
      opacity: 0; z-index: 9999;
      transition: transform 220ms ease, opacity 220ms ease;
    }
    body.is-dirty #unsavedBar, body.is-dirty .unsaved-bar {
      transform: translate(-50%, 0);
      opacity: 1;
    }
    #unsavedBar .btn-save, .unsaved-bar .btn-save {
      background: #ff5a5a !important;
      border: 1px solid rgba(255,255,255,0.18) !important;
      box-shadow: 0 0 0 0 rgba(255,90,90,0.6);
      transition: box-shadow 180ms ease, transform 120ms ease;
    }
    #unsavedBar .btn-save:hover, .unsaved-bar .btn-save:hover { transform: translateY(-1px); box-shadow: 0 6px 18px -8px rgba(255,90,90,0.7); }
    #unsavedBar .btn-revert, .unsaved-bar .btn-revert {
      background: rgba(0,0,0,0.5) !important;
      border: 1px solid rgba(255,255,255,0.12) !important;
    }
  `;
  document.head.appendChild(s);
}

/* ---------- Canvas DnD shim (capture-phase, survives re-renders) ---------- */

function wireCanvasDnd(){
  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  if (canvas.__kadieDndWired) return;
  canvas.__kadieDndWired = true;

  const onDragOver = (e) => {
    // Only allow when editor enabled and a system is selected
    if (!state.editorEnabled || !state.currentSystemId) return;
    // If payload looks like a Kadie element, allow drop
    try {
      const t = e.dataTransfer;
      if (!t) return;
      const hasKadie =
        t.types?.includes('application/kadie-element') ||
        t.types?.includes('kadie-element-id');
      if (!hasKadie) return;
      e.preventDefault();
      t.dropEffect = 'copy';
    } catch {}
  };

  const onDrop = (e) => {
    if (!state.editorEnabled || !state.currentSystemId) return;
    try {
      const t = e.dataTransfer;
      if (!t) return;
      const raw = t.getData('application/kadie-element');
      let meta = null;
      if (raw) {
        try { meta = JSON.parse(raw); } catch {}
      }
      if (!meta) {
        const id = t.getData('kadie-element-id');
        if (id && Array.isArray(window.__elementsCache)) {
          meta = window.__elementsCache.find(x => String(x.id) === String(id)) || null;
        }
      }
      if (!meta) return;

      e.preventDefault();

      // Convert client point to canvas content space
      const pt = clientToCanvasPoint(canvas, e.clientX, e.clientY);

      log('DnD drop', {
        id: meta.id, name: meta.name, at: pt, enabled: state.editorEnabled, sys: state.currentSystemId
      });

      addNodeFromElement(meta, pt.x, pt.y);

    } catch (err) {
      // Keep silent failure out of the way of other systems
      console.error('[Blueprints] drop handler error', err);
    }
  };

  // Capture-phase so replacements of .content/.nodes do not matter
  canvas.addEventListener('dragover', onDragOver, { capture: true });
  canvas.addEventListener('drop', onDrop, { capture: true });
}

// Map a screen point to the canvas ".content" space using its current CSS transform
function clientToCanvasPoint(canvasEl, clientX, clientY){
  const content = canvasEl.querySelector('.content') || canvasEl;
  const rect = content.getBoundingClientRect();
  const cs = getComputedStyle(content);
  const m = cs.transform;

  const x = clientX - rect.left;
  const y = clientY - rect.top;

  // Identity
  if (!m || m === 'none') {
    return { x, y };
  }

  // matrix(a, b, c, d, e, f) matrix(a, b, c, d, e, f) – translation (e,f) already in rect, so ignore
  let a=1, b=0, c=0, d=1;
  try {
    const parts = m.match(/matrix\(([-\d.,\s]+)\)/i);
    if (parts && parts[1]) {
      const vals = parts[1].split(',').map(v => parseFloat(v.trim()));
      if (vals.length >= 4) [a,b,c,d] = vals;
    }
  } catch {}

  // Invert 2D affine (ignoring shear off-diagonals is unsafe; do full inverse)
  const det = (a * d - b * c) || 1;
  const invA =  d / det;
  const invB = -b / det;
  const invC = -c / det;
  const invD =  a / det;

  return {
    x: invA * x + invC * y,
    y: invB * x + invD * y
  };
}

/* ---------- Unload guard ---------- */
(function guardUnload(){
  window.addEventListener('beforeunload', (e)=>{
    if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
  });
})();

/* ---------- Init ---------- */
(async function init(){
  injectCSS();
  log('init start');

  // Guild context
  const gid = params().get('guild_id') || '';
  const guilds = getJSON(['discord.guilds','discordGuilds']) || [];
  const guild = guilds.find(x => String(x.id) === String(gid));
  setGuild(gid, guild);

  renderHeader();
  await loadElementsSidebar();
  await refreshSystems();

  if (!state.currentSystemId) setEditorEnabled(false);

  // Build canvas and wire DnD shim
  renderAll();
  wireCanvasDnd();

  // Re-affirm wiring on editor toggle or graph rebuilds
  window.addEventListener('bp:editor-enabled', wireCanvasDnd, { capture: true });
  window.addEventListener('bp:graph-changed', wireCanvasDnd, { capture: true });

  log('init done');
})();
