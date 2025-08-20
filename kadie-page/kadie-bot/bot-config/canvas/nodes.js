// Drag-aware, axis-only separation (natural pushes) + node rendering
import { state, markDirty } from '../state.js';
import { dom, dragging, view } from './env.js';
import { escapeHtml, cssEscape } from './utils.js';
import { updateEdgesForNode, renderEdges, deleteEdgesForNode } from './edges.js';
import { selectNode, clearSelection } from './selection.js';
import { startLink } from './linking.js';
import { onContextNode } from './context.js';

/* ===== Physics tuning ===== */
const PHYS = {
  padding: 6,     // gap to leave between nodes after separation
  maxStep: 10,    // clamp per-correction movement to avoid jolts
  share: 0.9,     // how much correction to apply to neighbors (dragged node gets 0)
  iterations: 2,  // a couple of small passes per frame is enough
  axisBias: 1.75, // drag axis must be this much stronger to force that axis
  velSmooth: 0.6, // smoothing factor for instantaneous drag velocity
};
/* ========================== */

/* Pin visuals: exec triangles inside bubble, alignment, and hollow->filled data pins */
(function injectPinCss(){
  const id = 'kadie-pin-style';
  if (document.getElementById(id)) return;
  const css = `
    .node .ports .ioCol { display:flex; flex-direction:column; gap:6px; }

    .node .ports .port {
      display:flex; align-items:center; gap:8px;
      padding:4px 8px; border-radius:10px;
      background: color-mix(in srgb, var(--pin-color, #9aa) 18%, transparent);
      min-height:20px; max-width:260px;
    }
    .node .ports .port.in  { flex-direction:row;        justify-content:flex-start; }
    .node .ports .port.out { flex-direction:row-reverse; justify-content:flex-end; }

    .node .ports .port .label { line-height:1; white-space:nowrap; }
    .node .ports .port.in  .label { text-align:left;  margin-left:2px; }
    .node .ports .port.out .label { text-align:right; margin-right:2px; }

    /* Data pins: hollow ring until connected */
    .node .ports .port .portDot {
      width:12px; height:12px; display:inline-block;
      border-radius:50%;
      background:transparent;
      border:2px solid var(--pin-color, #9aa);
      box-sizing:border-box;
    }
    .node .ports .port.is-connected .portDot {
      background:var(--pin-color, #9aa);
      border-color:transparent;
    }

    /* Exec pins: solid triangle drawn inside fixed-size dot box */
    .node .ports .port.pin-flow .portDot {
      position:relative;
      width:14px; height:14px;
      background:transparent; border:none; border-radius:0;
    }
    .node .ports .port.pin-flow .portDot::before {
      content:""; position:absolute; inset:0;
      background:var(--exec-color, #fff);
      /* ▶ shape centered with small insets to avoid clipping */
      clip-path: polygon(15% 50%, 85% 15%, 85% 85%);
    }
    .node .ports .port.in.pin-flow .portDot::before {
      transform: scaleX(-1);
      transform-origin:50% 50%;
    }

    /* Type color tokens (bubble + data-pin color) */
    .node .ports .port.t-exec   { --pin-color:#ffffff; --exec-color:#ffffff; }
    .node .ports .port.t-boolean{ --pin-color:#e74c3c; }
    .node .ports .port.t-string { --pin-color:#d16fff; }
    .node .ports .port.t-float,
    .node .ports .port.t-number { --pin-color:#2ecc71; }
    .node .ports .port.t-int    { --pin-color:#27ae60; }
    .node .ports .port.t-any    { --pin-color:#aab3c2; }
  `;
  const el = document.createElement('style'); el.id = id; el.textContent = css; document.head.appendChild(el);
})();

export function ensureNodeDefaults(n){
  n.inputs  = Array.isArray(n.inputs) && n.inputs.length ? n.inputs : [{ name:'In',  kind:'data', type:'any' }];
  n.outputs = Array.isArray(n.outputs) && n.outputs.length ? n.outputs: [{ name:'Out', kind:'data', type:'any' }];
  if (typeof n.x !== 'number') n.x = 80;
  if (typeof n.y !== 'number') n.y = 60;
}

function typeClass(p){
  if (p.kind !== 'data') return ' t-exec';
  const t = String(p.type || 'any').toLowerCase().replace(/[^a-z0-9]+/g,'-');
  return ' t-' + t;
}

export function createNodeEl(n){
  ensureNodeDefaults(n);
  const el = document.createElement('div');
  el.className = 'node';
  el.dataset.id = n.id;
  el.style.left = n.x+'px';
  el.style.top  = n.y+'px';

  const ttl = document.createElement('div');
  ttl.className = 'title';
  ttl.innerHTML = `<span>${escapeHtml(n.name || n.id)}</span>`;
  el.appendChild(ttl);

  const ports = document.createElement('div'); ports.className='ports';
  const inCol  = document.createElement('div'); inCol.className  = 'ioCol';
  const outCol = document.createElement('div'); outCol.className = 'ioCol';

  (n.inputs||[]).forEach((p, idx)=>{
    const port = document.createElement('div');
    port.className = 'port in ' + (p.kind==='flow' ? 'pin-flow' : 'pin-data') + typeClass(p);
    port.dataset.portIndex = String(idx);
    port.dataset.dir = 'in';
    port.dataset.kind = p.kind || 'data';
    if (p.type) port.dataset.type = String(p.type).toLowerCase();
    port.innerHTML = `
      <span class="portDot"></span>
      <span class="label">${escapeHtml(p.name || '')}${p.kind==='data' ? ` : ${escapeHtml(p.type||'any')}`:''}</span>
    `;
    inCol.appendChild(port);
    port.addEventListener('contextmenu', (ev)=> onContextNode(ev, n.id));
  });

  (n.outputs||[]).forEach((p, idx)=>{
    const port = document.createElement('div');
    port.className = 'port out ' + (p.kind==='flow' ? 'pin-flow' : 'pin-data') + typeClass(p);
    port.dataset.portIndex = String(idx);
    port.dataset.dir = 'out';
    port.dataset.kind = p.kind || 'data';
    if (p.type) port.dataset.type = String(p.type).toLowerCase();
    port.innerHTML = `
      <span class="portDot"></span>
      <span class="label">${escapeHtml(p.name || '')}${p.kind==='data' ? ` : ${escapeHtml(p.type||'any')}`:''}</span>
    `;
    outCol.appendChild(port);
    port.addEventListener('pointerdown', (ev)=>{
      if (ev.button !== 0) return;
      ev.stopPropagation();
      startLink(ev, n.id, idx);
    });
    port.addEventListener('contextmenu', (ev)=> onContextNode(ev, n.id));
  });

  ports.appendChild(inCol);
  ports.appendChild(outCol);
  el.appendChild(ports);

  dom.nodes.appendChild(el);
  wireNodeDrag(el, n);
  updateEdgesForNode(n.id);
  return el;
}

export function renderNodes(){
  dom.nodes.innerHTML = '';
  for (const n of state.graph.nodes) createNodeEl(n);
  refreshAllPortConnections();
}

function moveNodeTo(el, n, x, y){
  n.x = x; n.y = y;
  el.style.left = x+'px';
  el.style.top  = y+'px';
  updateEdgesForNode(n.id);
}

/* mark ports as connected based on edges */
export function refreshAllPortConnections(){
  if (!dom.nodes) return;
  dom.nodes.querySelectorAll('.port.is-connected').forEach(p => p.classList.remove('is-connected'));
  const edges = state.graph.edges || [];
  for (const e of edges){
    const outSel = `.node[data-id="${cssEscape(e.from.node)}"] .port.out[data-port-index="${e.from.port|0}"]`;
    const inSel  = `.node[data-id="${cssEscape(e.to.node)}"] .port.in[data-port-index="${e.to.port|0}"]`;
    const outEl = dom.nodes.querySelector(outSel);
    const inEl  = dom.nodes.querySelector(inSel);
    if (outEl) outEl.classList.add('is-connected');
    if (inEl)  inEl.classList.add('is-connected');
  }
}

export function deleteNode(id){
  const idx = state.graph.nodes.findIndex(n => n.id===id);
  if (idx === -1) return;

  deleteEdgesForNode(id);

  state.graph.nodes.splice(idx, 1);

  const el = dom.nodes.querySelector(`[data-id="${cssEscape(id)}"]`);
  if (el && el.parentNode) el.parentNode.removeChild(el);

  renderEdges();
  refreshAllPortConnections();
  clearSelection();
  markDirty('deleteNode');
}

export function duplicateNode(id){
  const n = state.graph.nodes.find(n => n.id===id); if (!n) return;
  const copy = JSON.parse(JSON.stringify(n));
  copy.id = 'n_'+Math.random().toString(36).slice(2,9);
  copy.x = (n.x||0) + 30;
  copy.y = (n.y||0) + 30;
  state.graph.nodes.push(copy);
  createNodeEl(copy);
  refreshAllPortConnections();
  markDirty();
}

function wireNodeDrag(el, n){
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (ev)=>{
    if (ev.button !== 0) return;
    if (ev.target && ev.target.closest && ev.target.closest('.port')) return; // ports handle their own events
    ev.preventDefault();
    ev.stopPropagation();
    el.setPointerCapture(ev.pointerId);

    dragging.nodeId = n.id;
    dragging.active = true;
    dragging.startX = ev.clientX;
    dragging.startY = ev.clientY;
    dragging.nodeStartX = n.x;
    dragging.nodeStartY = n.y;
    dragging.vx = 0;
    dragging.vy = 0;

    let lastX = ev.clientX, lastY = ev.clientY;
    const scale = window.__KADIE_VIEW_SCALE__ || view.scale || 1;

    const onMove = (e)=>{
      const dx = (e.clientX - dragging.startX) / scale;
      const dy = (e.clientY - dragging.startY) / scale;

      const ivx = (e.clientX - lastX) / scale;
      const ivy = (e.clientY - lastY) / scale;
      lastX = e.clientX; lastY = e.clientY;
      dragging.vx = PHYS.velSmooth * dragging.vx + (1 - PHYS.velSmooth) * ivx;
      dragging.vy = PHYS.velSmooth * dragging.vy + (1 - PHYS.velSmooth) * ivy;

      moveNodeTo(el, n, dragging.nodeStartX + dx, dragging.nodeStartY + dy);
      resolveCollisionsIterative(n.id, dragging.vx, dragging.vy);
      markDirty();
    };

    const onUp = ()=>{
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      dragging.active = false;
      dragging.nodeId = '';
      renderEdges();
      refreshAllPortConnections();
      clearSelection();
      markDirty();
    };

    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
  });

  // Preserve node-level context menu
  el.addEventListener('contextmenu', (ev)=> onContextNode(ev, n.id));
}

/* =============== Collision =============== */

function rectOf(n, el){
  const w = el?.offsetWidth  || 180;
  const h = el?.offsetHeight || 90;
  return { left: n.x, top: n.y, right: n.x + w, bottom: n.y + h, width: w, height: h };
}

function intersects(a, b){
  return !(b.right <= a.left || b.left >= a.right || b.bottom <= a.top || b.top >= a.bottom);
}

function pickAxis(ra, rb, vx, vy){
  const ax = Math.abs(vx), ay = Math.abs(vy);
  if (ax > ay * PHYS.axisBias) return 'x';
  if (ay > ax * PHYS.axisBias) return 'y';
  const overlapX = Math.min(ra.right - rb.left, rb.right - ra.left);
  const overlapY = Math.min(ra.bottom - rb.top, rb.bottom - ra.top);
  return overlapX < overlapY ? 'x' : 'y';
}

function resolveCollisionsIterative(dragId, vx, vy){
  const a = state.graph.nodes.find(n => n.id === dragId); if (!a) return;
  const elA = dom.nodes.querySelector(`[data-id="${cssEscape(a.id)}"]`); if (!elA) return;

  let ra = rectOf(a, elA);
  let moved = false;
  for (let it=0; it<PHYS.iterations; it++){
    let any = false;

    for (const b of state.graph.nodes){
      if (b.id === a.id) continue;
      const elB = dom.nodes.querySelector(`[data-id="${cssEscape(b.id)}"]`);
      if (!elB) continue;
      const rb = rectOf(b, elB);

      if (!intersects(ra, rb)) continue;

      const axis = pickAxis(ra, rb, vx, vy);
      if (axis === 'x'){
        const overlapX = Math.min(ra.right - rb.left, rb.right - ra.left) + PHYS.padding;
        let dir = Math.sign(vx);
        if (!dir) dir = (rb.left + rb.width/2) >= (ra.left + ra.width/2) ? 1 : -1;
        const step = Math.max(-PHYS.maxStep, Math.min(PHYS.maxStep, overlapX * dir * PHYS.share));
        if (step){
          b.x += step;
          elB.style.left = b.x + 'px';
          updateEdgesForNode(b.id);
          any = moved = true;
        }
      } else {
        const overlapY = Math.min(ra.bottom - rb.top, rb.bottom - ra.top) + PHYS.padding;
        let dir = Math.sign(vy);
        if (!dir) dir = (rb.top + rb.height/2) >= (ra.top + ra.height/2) ? 1 : -1;
        const step = Math.max(-PHYS.maxStep, Math.min(PHYS.maxStep, overlapY * dir * PHYS.share));
        if (step){
          b.y += step;
          elB.style.top = b.y + 'px';
          updateEdgesForNode(b.id);
          any = moved = true;
        }
      }
    }

    if (!any) break;
    ra = rectOf(a, elA);
  }

  if (moved) markDirty();
}
