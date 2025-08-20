// Edges: persistence + rendering + incremental updates
// Edge shape: { id, from:{node,port}, to:{node,port}, kind:'flow'|'data', dataType?:string }

import { dom, view } from './env.js';
import { state, markDirty } from '../state.js';
import { cssEscape, wireD, portLocalXY } from './utils.js';

// ---------------- internals ----------------
function uid(p='e_'){ return p + Math.random().toString(36).slice(2,9); }

function ensureSvg(){
  if (!dom.svg){
    const vp = dom.vp || document.querySelector('[data-blueprint-viewport]') || document.querySelector('#canvas');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('wires');
    svg.style.position = 'absolute';
    svg.style.left = '0';
    svg.style.top = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    vp && vp.appendChild(svg);
    dom.svg = svg;
  }
  return dom.svg;
}

function ensurePath(edgeId){
  const svg = ensureSvg();
  const sel = `.wire[data-id="${cssEscape(edgeId)}"]`;
  let p = svg.querySelector(sel);
  if (!p){
    p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('fill','none');
    p.setAttribute('stroke','var(--wire, #aab)');
    p.setAttribute('stroke-width','2');
    p.classList.add('wire');
    p.dataset.id = edgeId;
    svg.appendChild(p);
  }
  return p;
}

function nodeElById(id){
  return dom.nodes?.querySelector(`.node[data-id="${cssEscape(id)}"]`);
}

// ---------------- path computation ----------------
function updateEdgePath(edge){
  const fromNodeEl = nodeElById(edge.from.node);
  const toNodeEl   = nodeElById(edge.to.node);
  if (!fromNodeEl || !toNodeEl) return;

  const a = portLocalXY(fromNodeEl, 'out', edge.from.port|0, view, dom.vp);
  const b = portLocalXY(toNodeEl,   'in',  edge.to.port|0,   view, dom.vp);

  const p = ensurePath(edge.id);
  p.setAttribute('d', wireD(a.x, a.y, b.x, b.y));
}

// ---------------- exports ----------------
export function createEdge(fromNode, fromPort, toNode, toPort, kind='data', dataType=null){
  (state.graph.edges ||= []);

  // prevent duplicates
  const exists = state.graph.edges.some(e =>
    e.from?.node===fromNode && (e.from?.port|0)===(fromPort|0) &&
    e.to?.node===toNode     && (e.to?.port|0)===(toPort|0)
  );
  if (exists) return null;

  const e = {
    id: uid('e_'),
    from: { node: fromNode, port: fromPort|0 },
    to:   { node: toNode,   port: toPort|0 },
    kind, dataType
  };
  state.graph.edges.push(e);
  markDirty('createEdge');
  createEdgeEl(e);
  return e;
}

export function createEdgeEl(edge){
  const p = ensurePath(edge.id);
  updateEdgePath(edge);

  // selection/context hooks injected by selection/context module
  p.addEventListener('pointerdown', ev => {
    if (ev.button!==0) return;
    _selectEdge?.(edge.id);
  });
  p.addEventListener('contextmenu', ev => {
    ev.preventDefault();
    _onContextEdge?.(ev, edge.id);
  });

  return p;
}

export function renderEdges(){
  ensureSvg();
  const edges = state.graph.edges || [];
  // Update or create all
  for (const e of edges) updateEdgePath(e);
  // Remove stray DOM paths for deleted edges
  dom.svg.querySelectorAll('.wire').forEach(p=>{
    const id = p.dataset.id;
    if (!edges.find(e=>e.id===id)) p.remove();
  });
}

export function updateEdgesForNode(nodeId){
  const edges = state.graph.edges || [];
  for (const e of edges){
    if (e.from?.node===nodeId || e.to?.node===nodeId) updateEdgePath(e);
  }
}

export function onViewTransformChanged(){
  renderEdges();
}

// ---- selection/context hooks (late bound to avoid cycles) ----
let _selectEdge = null;
let _onContextEdge = null;
export function _registerEdgeHooks(h){
  if (h && typeof h.selectEdge === 'function')   _selectEdge = h.selectEdge;
  if (h && typeof h.onContextEdge === 'function') _onContextEdge = h.onContextEdge;
}

// --- helpers for disconnections ---
export function deleteEdgesForNode(nodeId){
  const edges = state.graph.edges || [];
  const keep = [];
  for (const e of edges){
    const connected = (e.from?.node===nodeId) || (e.to?.node===nodeId);
    if (connected){
      dom.svg?.querySelectorAll(`.wire[data-id="${cssEscape(e.id)}"]`).forEach(el => el.remove());
    } else {
      keep.push(e);
    }
  }
  state.graph.edges = keep;
  markDirty('deleteEdgesForNode');
}

export function deleteFlowEdgesAt(nodeId, dir, portIndex){
  const edges = state.graph.edges || [];
  const keep = [];
  for (const e of edges){
    const isFlow = (e.kind === 'flow');
    const match = dir==='out'
      ? (e.from?.node===nodeId && (e.from?.port|0)===(portIndex|0))
      : (e.to?.node===nodeId   && (e.to?.port|0)===(portIndex|0));
    if (isFlow && match){
      dom.svg?.querySelectorAll(`.wire[data-id="${cssEscape(e.id)}"]`).forEach(el => el.remove());
    } else {
      keep.push(e);
    }
  }
  state.graph.edges = keep;
  markDirty('deleteFlowEdgesAt');
}
