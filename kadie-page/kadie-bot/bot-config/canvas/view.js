// view.js — Infinite canvas pan/zoom + robust debugs + wireDeleteKey export
// Adds makeIOColumns(schema): renders pins without auto-adding exec-in.
// Gestures: MMB drag = pan, Wheel = zoom at cursor, Ctrl/Cmd+0 = reset+center

import { dom, view } from './env.js';
import { clamp } from './utils.js';
import { state } from '../state.js';

// ---- constants ----
const SCALE_MIN  = 0.25;
const SCALE_MAX  = 2.5;
const SCALE_STEP = 1.1;

// ---- safe logger ----
function slog(...args){ try { console.log('[Blueprints]', ...args); } catch(_) {} }

// ---- debug HUD ----
let dbg = { globalMMB:false, canvasMMB:false, lastWheel:0 };
let dbgEl = null;
function ensureDebugHud(){
  if (!window.KADIE_DEBUG) return;
  if (dbgEl) return;
  dbgEl = document.createElement('div');
  dbgEl.id = 'kadieDebugHud';
  Object.assign(dbgEl.style, {
    position:'fixed', left:'8px', bottom:'8px', zIndex:'999999',
    background:'rgba(0,0,0,0.6)', color:'#c3f1d9', fontFamily:'monospace',
    fontSize:'12px', padding:'6px 8px', border:'1px solid rgba(255,255,255,0.12)',
    borderRadius:'8px', pointerEvents:'none', userSelect:'none', whiteSpace:'pre',
  });
  document.body.appendChild(dbgEl);
  (function tick(){
    if (!dbgEl) return;
    dbgEl.textContent =
      `MMB (global): ${dbg.globalMMB?'DOWN':'up'}\n` +
      `MMB (canvas): ${dbg.canvasMMB?'DOWN':'up'}\n` +
      `Last wheel: ${dbg.lastWheel? (Date.now()-dbg.lastWheel)+'ms ago' : '—' }\n` +
      `Scale: ${view.scale?.toFixed?.(3) ?? '—'}   Tx/Ty: ${Math.round(view.tx||0)}, ${Math.round(view.ty||0)}`;
    requestAnimationFrame(tick);
  })();
}

// ---- DOM build ----
export function buildDom(root){
  dom.vp = root;
  dom.vp.style.position = dom.vp.style.position || 'relative';
  dom.vp.style.overflow = 'hidden';
  dom.vp.style.touchAction = 'none';

  if (!dom.content){
    dom.content = document.createElement('div');
    dom.content.className = 'content';
    Object.assign(dom.content.style, {
      position:'absolute', left:'0', top:'0',
      transformOrigin:'0 0', willChange:'transform',
    });
    dom.vp.appendChild(dom.content);
  }

  if (!dom.svg){
    dom.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    dom.svg.classList.add('wires');
    dom.svg.setAttribute('width','100%'); dom.svg.setAttribute('height','100%');
    Object.assign(dom.svg.style,{ position:'absolute', left:'0', top:'0', pointerEvents:'none' });
    dom.content.appendChild(dom.svg);
  }

  if (!dom.nodes){
    dom.nodes = document.createElement('div');
    dom.nodes.className = 'nodes';
    Object.assign(dom.nodes.style,{ position:'absolute', left:'0', top:'0', pointerEvents:'auto' });
    dom.content.appendChild(dom.nodes);
  }

  if (!document.getElementById('canvas-center-btn')){
    const btn = document.createElement('button');
    btn.id = 'canvas-center-btn';
    btn.textContent = 'Center';
    Object.assign(btn.style, {
      position:'absolute', top:'8px', right:'8px', zIndex:'5',
      background:'rgba(0,0,0,.5)', color:'white',
      border:'1px solid rgba(255,255,255,.15)', borderRadius:'8px',
      padding:'6px 10px', cursor:'pointer'
    });
    btn.addEventListener('click', () => centerOnGraph());
    dom.vp.appendChild(btn);
  }

  ensureDebugHud();
  slog('view.js loaded');
}

// ---- transform helpers ----
export function applyTransform(){
  if (!dom.content) return;
  dom.content.style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`;
  window.__KADIE_VIEW_SCALE__ = view.scale;
}

// ---- pan + zoom wiring ----
export function wirePanZoom(){
  ensureDebugHud();

  // Global MMB debug
  const globalDown = (ev)=>{ if (ev.button===1){ dbg.globalMMB=true;  slog('MMB DOWN (global)', ev.target); } };
  const globalUp   = (ev)=>{ if (ev.button===1){ dbg.globalMMB=false; slog('MMB UP (global)',   ev.target); } };
  window.addEventListener('mousedown', globalDown, true);
  window.addEventListener('mouseup',   globalUp,   true);

  // Wheel zoom
  const onWheel = (ev)=>{
    if (!dom?.vp) return;
    if (ev.shiftKey) return;
    ev.preventDefault();
    dbg.lastWheel = Date.now();

    const r = dom.vp.getBoundingClientRect();
    const mx = ev.clientX - r.left;
    const my = ev.clientY - r.top;

    const wx = (mx - view.tx) / view.scale;
    const wy = (my - view.ty) / view.scale;

    const factor    = (ev.deltaY < 0) ? (1/1.1) : 1.1;
    const nextScale = clamp(view.scale * factor, SCALE_MIN, SCALE_MAX);

    view.tx = mx - wx * nextScale;
    view.ty = my - wy * nextScale;
    view.scale = nextScale;
    applyTransform();

    slog('WHEEL zoom', { deltaY: ev.deltaY, scale: view.scale.toFixed(3) });
  };
  dom.vp.addEventListener('wheel', onWheel, { passive:false, capture:true });
  window.addEventListener('wheel', (ev)=>{
    if (!dom?.vp) return;
    const r = dom.vp.getBoundingClientRect();
    if (ev.clientX>=r.left && ev.clientX<=r.right && ev.clientY>=r.top && ev.clientY<=r.bottom){ onWheel(ev); }
  }, { passive:false, capture:true });

  // MMB pan
  let panning=false, sx=0, sy=0, stx=0, sty=0;
  const startPan = (ev)=>{
    if (ev.button===1){ dbg.canvasMMB=true; slog('MMB DOWN (canvas)', ev.target); }
    if (ev.button!==1) return;
    ev.preventDefault();
    panning=true; dom.vp.style.cursor='grabbing';
    sx=ev.clientX; sy=ev.clientY; stx=view.tx; sty=view.ty;
    window.addEventListener('mousemove', movePan, true);
    window.addEventListener('mouseup',   endPan,  true);
  };
  const movePan = (ev)=>{
    if (!panning) return;
    view.tx = stx + (ev.clientX - sx);
    view.ty = sty + (ev.clientY - sy);
    applyTransform();
  };
  const endPan = (ev)=>{
    if (ev?.button===1){ dbg.canvasMMB=false; slog('MMB UP (canvas)', ev.target); }
    panning=false; dom.vp.style.cursor='';
    window.removeEventListener('mousemove', movePan, true);
    window.removeEventListener('mouseup',   endPan,  true);
  };
  dom.vp.addEventListener('mousedown', startPan, true);
  dom.nodes.addEventListener('mousedown', startPan, true);

  // Ctrl/Cmd+0 to reset
  window.addEventListener('keydown', (ev)=>{
    if ((ev.ctrlKey||ev.metaKey) && ev.key==='0'){ resetView(); }
  }, true);
}

// ---- extra keyboard wiring (kept for back-compat with index.js imports) ----
export function wireDeleteKey(){
  // Currently mapped to reset (Ctrl/Cmd+0). Leave here for compatibility.
  // If you later re-bind Delete to node removal, this is the hook other modules call.
  window.addEventListener('keydown', (ev)=>{
    if (['INPUT','TEXTAREA','SELECT'].includes(ev.target?.nodeName)) return;
    if ((ev.ctrlKey||ev.metaKey) && ev.key === '0'){ resetView(); }
  }, true);
}

// ---- centering ----
export function centerOnGraph(){
  const { cx, cy } = computeGraphCenter();
  const vp = dom.vp.getBoundingClientRect();
  view.tx = vp.width * 0.5 - cx * view.scale;
  view.ty = vp.height * 0.5 - cy * view.scale;
  applyTransform();
  slog('centerOnGraph', { cx, cy, tx:view.tx, ty:view.ty, scale:view.scale });
}
export function resetView(){
  view.scale = 1;
  centerOnGraph();
  slog('resetView');
}
function computeGraphCenter(){
  const nodes = state?.graph?.nodes || [];
  if (!nodes.length) return { cx:0, cy:0 };
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for (const n of nodes){
    const x=+n.x||0, y=+n.y||0, w=+n.w||200, h=+n.h||100;
    if (x<minX) minX=x; if (y<minY) minY=y;
    if (x+w>maxX) maxX=x+w; if (y+h>maxY) maxY=y+h;
  }
  return { cx:(minX+maxX)/2, cy:(minY+maxY)/2 };
}

// Back-compat hook
export function _registerViewHooks(h){
  if (typeof h === 'function'){
    h({ applyTransform, centerOnGraph, resetView, view, dom });
  }
}

/* -------------------------------------------------------------------------- */
/*  Ports renderer: do NOT add exec-in unless schema.inputs.exec === 'flow'    */
/* -------------------------------------------------------------------------- */

// Fallback maker if your global/project makePort is not available
function _defaultMakePort({ dir, name, type }){
  const el = document.createElement('div');
  el.className = `port ${dir}`;
  el.dataset.port = name;
  el.dataset.type = type;
  const dot = document.createElement('div');
  dot.className = 'portDot';
  const label = document.createElement('span');
  label.textContent = name;
  el.append(dot, label);
  return el;
}

/**
 * Render input/output columns for a node schema.
 * - Only renders a flow input if explicitly declared as inputs.exec === 'flow'.
 * - Hides the left column if no inputs exist (event-start nodes).
 */
export function makeIOColumns(schema){
  const inCol  = document.createElement('div');  inCol.className  = 'ioCol ioIn';
  const outCol = document.createElement('div');  outCol.className = 'ioCol ioOut';

  const hasExecIn = !!(schema?.inputs && schema.inputs.exec === 'flow');

  // choose maker: external makePort if present, else local default
  /* eslint-disable no-undef */
  const maker = (typeof makePort === 'function')
    ? makePort
    : (typeof window !== 'undefined' && typeof window.makePort === 'function'
        ? window.makePort
        : _defaultMakePort);
  /* eslint-enable no-undef */

  // INPUTS
  if (schema?.inputs){
    for (const [name, type] of Object.entries(schema.inputs)){
      if (name === 'exec' && !hasExecIn) continue;          // key rule
      inCol.appendChild(maker({ dir:'in', name, type }));
    }
  }

  // OUTPUTS
  if (schema?.outputs){
    for (const [name, type] of Object.entries(schema.outputs)){
      outCol.appendChild(maker({ dir:'out', name, type }));
    }
  }

  // Hide empty left column for event-start nodes
  if (!inCol.children.length) inCol.style.display = 'none';

  const wrap = document.createElement('div');
  wrap.className = 'ports';
  wrap.append(inCol, outCol);
  return wrap;
}
