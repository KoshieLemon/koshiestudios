// Drag-aware, axis-only separation (natural pushes) + node rendering
import { state, markDirty } from '../state.js';
import { dom, dragging, view } from './env.js';
import { escapeHtml, cssEscape } from './utils.js';
import { updateEdgesForNode, renderEdges } from './edges.js';
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

export function ensureNodeDefaults(n){
  n.inputs  = Array.isArray(n.inputs) && n.inputs.length ? n.inputs : [{ name:'In',  kind:'data', type:'any' }];
  n.outputs = Array.isArray(n.outputs) && n.outputs.length ? n.outputs: [{ name:'Out', kind:'data', type:'any' }];
  if (typeof n.x !== 'number') n.x = 80;
  if (typeof n.y !== 'number') n.y = 60;
}

export function createNodeEl(n){
  ensureNodeDefaults(n);
  const el = document.createElement('div');
  el.className = 'node';
  el.dataset.id = n.id;
  el.style.left = n.x+'px';
  el.style.top  = n.y+'px';

  // Title
  const ttl = document.createElement('div');
  ttl.className = 'title';
  ttl.innerHTML = `<span>${escapeHtml(n.name || n.id)}</span>`;
  el.appendChild(ttl);

  // Ports
  const ports = document.createElement('div'); ports.className='ports';
  const inCol  = document.createElement('div'); inCol.className  = 'ioCol';
  const outCol = document.createElement('div'); outCol.className = 'ioCol';

  (n.inputs||[]).forEach((p)=>{
    const port = document.createElement('div');
    port.className = 'port in ' + (p.kind==='flow' ? 'pin-flow' : 'pin-data');
    port.innerHTML = `
      <span class="portDot"></span>
      <span>${escapeHtml(p.name || '')}${p.kind==='data' ? ` : ${escapeHtml(p.type||'any')}`:''}</span>
    `;
    inCol.appendChild(port);
    port.addEventListener('contextmenu', (ev)=> onContextNode(ev, n.id));
  });

  (n.outputs||[]).forEach((p, idx)=>{
    const port = document.createElement('div');
    port.className = 'port out ' + (p.kind==='flow' ? 'pin-flow' : 'pin-data');
    port.innerHTML = `
      <span>${escapeHtml(p.name || '')}${p.kind==='data' ? ` : ${escapeHtml(p.type||'any')}`:''}</span>
      <span class="portDot"></span>
    `;
    outCol.appendChild(port);
    port.addEventListener('pointerdown', (ev)=> startLink(ev, n.id, idx));
    port.addEventListener('contextmenu', (ev)=> onContextNode(ev, n.id));
  });

  ports.appendChild(inCol);
  ports.appendChild(outCol);
  el.appendChild(ports);

  wireNodeDrag(el, n);

  el.addEventListener('pointerdown', (ev)=>{ if (ev.button===0) selectNode(n.id); });
  el.addEventListener('contextmenu', (ev)=> onContextNode(ev, n.id));

  dom.nodes.appendChild(el);
  updateEdgesForNode(n.id);
  return el;
}

export function renderNodes(){
  dom.nodes.innerHTML = '';
  for (const n of state.graph.nodes) createNodeEl(n);
}

function moveNodeTo(el, n, x, y){
  n.x = x; n.y = y;
  el.style.left = x+'px';
  el.style.top  = y+'px';
  updateEdgesForNode(n.id);
}

export function deleteNode(id){
  const idx = state.graph.nodes.findIndex(n => n.id===id);
  if (idx === -1) return;
  state.graph.nodes.splice(idx, 1);
  const el = dom.nodes.querySelector(`[data-id="${cssEscape(id)}"]`);
  if (el && el.parentNode) el.parentNode.removeChild(el);
  renderEdges();
  clearSelection();
  markDirty();
}

export function duplicateNode(id){
  const n = state.graph.nodes.find(n => n.id===id); if (!n) return;
  const copy = JSON.parse(JSON.stringify(n));
  copy.id = 'n_'+Math.random().toString(36).slice(2,9);
  copy.x += 30; copy.y += 30;
  state.graph.nodes.push(copy);
  createNodeEl(copy);
  markDirty();
}

function wireNodeDrag(el, n){
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (ev)=>{
    if (ev.button !== 0) return;
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

      // instantaneous drag velocity (smoothed)
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
      clearSelection();
      markDirty();
    };

    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
  });
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
  // fallback to minimal overlap
  const overlapX = Math.min(ra.right - rb.left, rb.right - ra.left);
  const overlapY = Math.min(ra.bottom - rb.top, rb.bottom - ra.top);
  return overlapX < overlapY ? 'x' : 'y';
}

function resolveCollisionsIterative(dragId, vx, vy){
  const a = state.graph.nodes.find(n => n.id === dragId); if (!a) return;
  const elA = dom.nodes.querySelector(`[data-id="${cssEscape(a.id)}"]`); if (!elA) return;

  // Work entirely in world/content coordinates (n.x/n.y + element sizes)
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
        // Push purely horizontally (no diagonal drift)
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
        // Push purely vertically
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

    // Refresh dragged rect from its current world coords (a.x/a.y and el size)
    ra = rectOf(a, elA);
  }

  if (moved) markDirty();
}
