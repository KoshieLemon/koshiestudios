import { dom, view, getLinking, setLinking } from './env.js';
import { wireD, portLocalXY, cssEscape } from './utils.js';
import { pinsCompatible } from './types.js';
import { createEdge } from './edges.js';
import { state, markDirty } from '../state.js';

export function startLink(ev, nodeId, portIdx){
  ev.stopPropagation();
  const node = state.graph.nodes.find(n => n.id===nodeId);
  const outPin = node?.outputs[portIdx|0];
  setLinking({
    fromNode: nodeId,
    fromPort: portIdx|0,
    kind: outPin?.kind || 'data',
    dataType: (outPin?.type||null),
    pathEl: null,
  });
  const tmp = document.createElementNS('http://www.w3.org/2000/svg','path');
  tmp.classList.add('wire');
  dom.svg.appendChild(tmp);
  getLinking().pathEl = tmp;
  updateTempLink(ev);

  const cancel = ()=>{
    const l = getLinking(); if (!l) return;
    dom.svg.removeChild(l.pathEl);
    setLinking(null);
    window.removeEventListener('pointerup', cancel, true);
  };
  window.addEventListener('pointerup', cancel, true);
  dom.nodes.addEventListener('pointerup', onLinkPointerUp, { once:true, capture:true });
}

function onLinkPointerUp(ev){
  const l = getLinking(); if (!l) return;
  const inEl = ev.target.closest('.port.in');
  if (inEl) {
    const toNode = inEl.closest('.node')?.dataset.id;
    const toPort = parseInt(inEl.dataset.portIndex||'0',10);
    if (toNode && toNode !== l.fromNode) {
      const outPin = state.graph.nodes.find(n=> n.id===l.fromNode)?.outputs[l.fromPort];
      const inPin  = state.graph.nodes.find(n=> n.id===toNode)?.inputs[toPort];
      if (pinsCompatible(outPin, inPin)) {
        createEdge(l.fromNode, l.fromPort, toNode, toPort, outPin.kind, outPin.type);
        markDirty();
      } else {
        inEl.animate([{transform:'scale(1)'},{transform:'scale(1.05)'},{transform:'scale(1)'}], {duration:200});
      }
    }
  }
  const l2 = getLinking();
  if (l2) { dom.svg.removeChild(l2.pathEl); setLinking(null); }
}

export function updateTempLink(ev){
  const l = getLinking(); if (!l) return;
  const rect = dom.vp.getBoundingClientRect();
  const mx = (ev.clientX - rect.left - view.tx) / view.scale;
  const my = (ev.clientY - rect.top  - view.ty) / view.scale;
  const fromEl = dom.nodes.querySelector('.node[data-id="'+cssEscape(l.fromNode)+'"]');
  const from = portLocalXY(fromEl, 'out', l.fromPort);
  const d = wireD(from.x, from.y, mx, my);
  l.pathEl.setAttribute('d', d);
}

// wire pointer move to see live temp link
window.addEventListener('pointermove', (ev)=>{
  if (getLinking()) updateTempLink(ev);
});
