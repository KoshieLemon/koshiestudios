import { dom } from './env.js';
import { state } from '../state.js';
import { cssEscape, wireD, portLocalXY } from './utils.js';

export function createEdge(fromNode, fromPort, toNode, toPort, kind, dataType){
  (state.graph.edges ||= []);
  const exists = state.graph.edges.some(e =>
    e.from?.node===fromNode && e.from?.port===fromPort && e.to?.node===toNode && e.to?.port===toPort
  );
  if (exists) return null;
  const e = { id: uid('e_'), from:{node:fromNode, port:fromPort}, to:{node:toNode, port:toPort}, kind, dataType };
  state.graph.edges.push(e);
  createEdgeEl(e);
  return e;
}

export function createEdgeEl(e){
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.classList.add('wire');
  path.dataset.id = e.id || (e.id = uid('e_'));

  const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  hit.classList.add('wire','hit');
  hit.dataset.id = path.dataset.id;

  dom.svg.appendChild(path);
  dom.svg.appendChild(hit);
  updateEdgePath(e);

  const onClick = ()=> selectEdge(e.id);
  path.addEventListener('pointerdown', onClick);
  hit.addEventListener('pointerdown', onClick);

  path.addEventListener('contextmenu', (ev)=> onContextEdge(ev, e.id));
  hit.addEventListener('contextmenu', (ev)=> onContextEdge(ev, e.id));
}

export function updateEdgePath(e){
  const nodeFrom = document.querySelector(`.node[data-id="${cssEscape(e.from.node)}"]`);
  const nodeTo   = document.querySelector(`.node[data-id="${cssEscape(e.to.node)}"]`);
  const a = portLocalXY(nodeFrom, 'out', e.from.port);
  const b = portLocalXY(nodeTo,   'in',  e.to.port);
  const d = wireD(a.x, a.y, b.x, b.y);
  const p = dom.svg.querySelector('path[data-id="'+cssEscape(e.id)+'"]');
  const h = dom.svg.querySelector('path.hit[data-id="'+cssEscape(e.id)+'"]');
  if (p) p.setAttribute('d', d);
  if (h) h.setAttribute('d', d);
}

export function updateEdgesForNode(nodeId){
  for (const e of (state.graph.edges||[])) {
    if ((e.from?.node===nodeId) || (e.to?.node===nodeId)) updateEdgePath(e);
  }
}

export function renderEdges(){
  dom.svg.innerHTML = '';
  for (const e of (state.graph.edges||[])) createEdgeEl(e);
}

// hooks set by other modules to avoid circular imports
let selectEdge = ()=>{};
let onContextEdge = ()=>{};
export function _registerEdgeHooks(h){
  if (h.selectEdge)   selectEdge = h.selectEdge;
  if (h.onContextEdge) onContextEdge = h.onContextEdge;
}

function uid(p='e_'){ return p + Math.random().toString(36).slice(2,9); }
// (no-op; edges hooks are registered from selection/context at import time)