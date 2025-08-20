// Kadie Bot Config — Context Menu (nodes/edges only, fixed-at-cursor)
// - Shows menu ONLY on node (Delete/Duplicate) or edge (Delete).
// - On empty canvas right-click: no menu.
// - Position: fixed on <body> -> always at mouse, unaffected by canvas transforms.
// - Exports: onContextNode, onContextEdge, wireContextMenu, ContextMenu.

import { deleteNode, duplicateNode } from './nodes.js';
import { selectNode, selectEdge, clearSelection } from './selection.js';
import { state, markDirty } from '../state.js';

// ---- Edge delete shim (use your real delete if you have it)
function _inlineDeleteEdge(id){
  if (!id) return;
  if (state?.graph?.edges) state.graph.edges = state.graph.edges.filter(e => e.id !== id);
  document.querySelectorAll(`.wire[data-id="${CSS.escape(id)}"]`).forEach(el => el.remove());
  if (typeof markDirty === 'function') markDirty();
}
const edgeDelete = _inlineDeleteEdge;

// ---- Style (self-contained)
(function ensureStyle(){
  if (document.getElementById('kadie-ctx-style')) return;
  const css = `
    #kadieCtxMenu{
      position: fixed; top:0; left:0; transform:none;
      z-index: 999999;
      min-width: 180px;
      background: rgba(18,18,18,0.98);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.55);
      backdrop-filter: blur(6px);
      padding: 6px;
      display: none;
      user-select: none;
    }
    #kadieCtxMenu.show{ display:block; }
    #kadieCtxMenu hr{
      border: none; height: 1px;
      background: rgba(255,255,255,0.08);
      margin: 6px 0;
    }
    #kadieCtxMenu button{
      width: 100%;
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px;
      background: transparent; border: 0; color: #eee;
      font: 500 13px/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
      border-radius: 8px; cursor: pointer; text-align: left;
    }
    #kadieCtxMenu button:hover{ background: rgba(255,255,255,0.08); }
    #kadieCtxMenu button[data-danger="true"]{ color:#ff6565; }
  `;
  const style = document.createElement('style');
  style.id = 'kadie-ctx-style';
  style.textContent = css;
  document.head.appendChild(style);
})();

// ---- DOM
function ensureMenu(){
  let el = document.getElementById('kadieCtxMenu');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'kadieCtxMenu';
  el.innerHTML = `
    <button data-action="delete" data-danger="true">Delete</button>
    <button data-action="duplicate">Duplicate</button>
    <hr />
  `;
  document.body.appendChild(el);
  return el;
}
const ctx = ensureMenu();

function hideMenu(){ ctx.classList.remove('show'); }
function showMenuAtClientXY(clientX, clientY){
  // measure to clamp
  ctx.style.visibility = 'hidden';
  ctx.classList.add('show');
  const mw = ctx.offsetWidth || 180;
  const mh = ctx.offsetHeight || 100;
  ctx.classList.remove('show');
  ctx.style.visibility = '';

  const vw = window.innerWidth, vh = window.innerHeight;
  const x = Math.max(0, Math.min(clientX, vw - mw));
  const y = Math.max(0, Math.min(clientY, vh - mh));

  ctx.style.left = x + 'px';
  ctx.style.top  = y + 'px';
  ctx.classList.add('show');
}

// ---- Mode control
function setMode(mode){
  const btnDel = ctx.querySelector('[data-action="delete"]');
  const btnDup = ctx.querySelector('[data-action="duplicate"]');
  const hr     = ctx.querySelector('hr');

  // default hide both
  btnDel.style.display = 'none';
  btnDup.style.display = 'none';
  hr.style.display     = 'none';

  if (mode === 'node'){
    btnDel.style.display = '';
    btnDup.style.display = '';
    hr.style.display     = '';
  } else if (mode === 'edge'){
    btnDel.style.display = '';
    hr.style.display     = '';
  }
}

// ---- Menu clicks
ctx.addEventListener('click', (ev)=>{
  const btn = ev.target.closest('button'); if (!btn) return;
  const action = btn.dataset.action;
  const selNode = document.querySelector('.node.selected');
  const selEdge = document.querySelector('.wire.selected');

  if (action === 'delete'){
    const nodeId = selNode?.dataset?.id;
    if (nodeId) deleteNode(nodeId);
    else if (selEdge?.dataset?.id) edgeDelete(selEdge.dataset.id);
  } else if (action === 'duplicate'){
    const nodeId = selNode?.dataset?.id;
    if (nodeId) duplicateNode(nodeId);
  }
  hideMenu();
});

// Dismiss
document.addEventListener('pointerdown', (e)=>{
  if (!ctx.contains(e.target)) hideMenu();
});
window.addEventListener('blur', hideMenu);

// ---- Contextmenu routing
function findClosest(el, selector){ return el?.closest?.(selector) ?? null; }

function handleContextAt(ev){
  ev.preventDefault(); // always kill native menu
  const nodeEl = findClosest(ev.target, '.node');
  const edgeEl = nodeEl ? null : findClosest(ev.target, '.wire');

  if (nodeEl){
    const id = nodeEl.dataset?.id;
    if (typeof selectNode === 'function') selectNode(id);
    setMode('node');
    showMenuAtClientXY(ev.clientX, ev.clientY);
    return;
  }
  if (edgeEl){
    const id = edgeEl.dataset?.id;
    if (typeof selectEdge === 'function') selectEdge(id);
    setMode('edge');
    showMenuAtClientXY(ev.clientX, ev.clientY);
    return;
  }

  // Empty canvas -> no menu at all
  hideMenu();
  if (typeof clearSelection === 'function') clearSelection();
}

// ---- Legacy exports expected by your code
export function onContextNode(ev, nodeId){
  ev.preventDefault();
  if (typeof selectNode === 'function') selectNode(nodeId);
  setMode('node');
  showMenuAtClientXY(ev.clientX, ev.clientY);
}
export function onContextEdge(ev, edgeId){
  ev.preventDefault();
  if (typeof selectEdge === 'function') selectEdge(edgeId);
  setMode('edge');
  showMenuAtClientXY(ev.clientX, ev.clientY);
}
export function wireContextMenu(viewportEl){
  (viewportEl || document).addEventListener('contextmenu', handleContextAt, { capture:true });
}
export const ContextMenu = {
  showAt(x,y,mode='node'){ setMode(mode); showMenuAtClientXY(x,y); },
  hide: hideMenu,
};
