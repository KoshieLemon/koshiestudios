// Live linking: drag from an OUTPUT pin to an INPUT pin. Persist only on valid match.
// Adds: green/red reset when leaving targets, global “linking-mode” dim overlay,
// and pin-match highlighting for compatible inputs. Exec pins remain single-connection.
import { dom, view, getLinking, setLinking } from './env.js';
import { cssEscape, wireD, portLocalXY } from './utils.js';
import { pinsCompatible } from './types.js';
import { state, markDirty } from '../state.js';
import { createEdge, renderEdges, deleteFlowEdgesAt } from './edges.js';

function nodeElById(id){
  return dom.nodes?.querySelector(`.node[data-id="${cssEscape(id)}"]`);
}
function getPinMeta(nodeId, dir, index){
  const n = (state.graph.nodes||[]).find(nn => String(nn.id)===String(nodeId));
  if (!n) return null;
  const arr = dir==='out' ? (n.outputs||[]) : (n.inputs||[]);
  return arr[index|0] || null;
}
function findTargetPortAt(clientX, clientY){
  const el = document.elementFromPoint(clientX, clientY);
  return el?.closest?.('.port.in') || null;
}

function clearIndicators(){
  dom.nodes?.querySelectorAll('.port.pin-hover,.port.pin-ok,.port.pin-bad,.port.pin-match')
    .forEach(el => el.classList.remove('pin-hover','pin-ok','pin-bad','pin-match'));
}
function enterLinkingMode(){
  dom.nodes?.classList.add('linking-mode');
}
function exitLinkingMode(){
  dom.nodes?.classList.remove('linking-mode');
  clearIndicators();
}

function removePreview(){
  const l = getLinking();
  if (l && l.pathEl && l.pathEl.parentNode) l.pathEl.parentNode.removeChild(l.pathEl);
  setLinking(null);
}
function markCompatibleInputs(fromNodeId, fromOutIndex){
  const outPin = getPinMeta(fromNodeId, 'out', fromOutIndex);
  const ports = Array.from(dom.nodes?.querySelectorAll('.port.in') || []);
  for (const inEl of ports){
    const toNode = inEl.closest('.node')?.dataset.id || '';
    const toPort = parseInt(inEl.dataset.portIndex||'0',10);
    const inPin  = getPinMeta(toNode, 'in', toPort);
    if (pinsCompatible(outPin, inPin)) inEl.classList.add('pin-match');
  }
}

function updatePreview(ev){
  const l = getLinking(); if (!l) return;

  // Start coord from OUT pin center
  const fromNodeEl = nodeElById(l.fromNode);
  const a = portLocalXY(fromNodeEl, 'out', l.fromPort, view, dom.vp);

  // Default end is mouse in world coords
  const r = dom.vp.getBoundingClientRect();
  let endX = (ev.clientX - r.left - (view.tx||0)) / (view.scale||1);
  let endY = (ev.clientY - r.top  - (view.ty||0)) / (view.scale||1);

  // Hover detection and snap
  const tgt = findTargetPortAt(ev.clientX, ev.clientY);
  if (tgt){
    if (l.hoverEl !== tgt){
      if (l.hoverEl) l.hoverEl.classList.remove('pin-hover','pin-ok','pin-bad');
      l.hoverEl = tgt;
    }
    const toNode = tgt.closest('.node')?.dataset.id || '';
    const toPort = parseInt(tgt.dataset.portIndex||'0',10);
    const toNodeEl = nodeElById(toNode);
    const b = portLocalXY(toNodeEl, 'in', toPort, view, dom.vp);
    endX = b.x; endY = b.y;

    const outPin = getPinMeta(l.fromNode, 'out', l.fromPort);
    const inPin  = getPinMeta(toNode, 'in', toPort);
    const ok = pinsCompatible(outPin, inPin);

    tgt.classList.add('pin-hover');
    tgt.classList.toggle('pin-ok',  !!ok);
    tgt.classList.toggle('pin-bad', !ok);
  } else {
    // Reset green/red when not over a target
    if (l.hoverEl){
      l.hoverEl.classList.remove('pin-hover','pin-ok','pin-bad');
      l.hoverEl = null;
    }
  }

  // Update path
  const d = wireD(a.x, a.y, endX, endY);
  l.pathEl.setAttribute('d', d);
}

function onPointerUp(ev){
  const l = getLinking(); if (!l) return;
  window.removeEventListener('pointermove', updatePreview, true);
  window.removeEventListener('pointerup', onPointerUp, true);

  const tgt = ev.target.closest?.('.port.in') || findTargetPortAt(ev.clientX, ev.clientY);

  // Always exit UI state
  exitLinkingMode();
  removePreview();

  if (!tgt) return; // not dropped on a pin

  const toNode = tgt.closest('.node')?.dataset.id;
  const toPort = parseInt(tgt.dataset.portIndex||'0',10);
  if (!toNode || toNode === l.fromNode) return;

  const outPin = getPinMeta(l.fromNode, 'out', l.fromPort);
  const inPin  = getPinMeta(toNode, 'in',  toPort);
  if (!pinsCompatible(outPin, inPin)) return;

  // Enforce single-connection for flow pins
  if ((outPin?.kind||'data') === 'flow') {
    deleteFlowEdgesAt(l.fromNode, 'out', l.fromPort);
    deleteFlowEdgesAt(toNode, 'in', toPort);
  }

  // Create and render persistent edge
  createEdge(l.fromNode, l.fromPort, toNode, toPort, outPin?.kind || 'data', outPin?.type || null);
  renderEdges();
  markDirty('connectPins');
}

export function startLink(ev, fromNodeId, fromOutIndex){
  if (!dom.svg || !dom.vp) return;

  // Clean previous indicators and enter overlay mode
  clearIndicators();
  enterLinkingMode();
  markCompatibleInputs(fromNodeId, fromOutIndex);

  // Build preview path
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill','none');
  path.setAttribute('stroke','var(--wire-preview, #88c)');
  path.setAttribute('stroke-width','2');
  path.setAttribute('stroke-dasharray','4 3');
  path.classList.add('wire','wire-preview');
  dom.svg.appendChild(path);

  setLinking({
    fromNode: fromNodeId,
    fromPort: fromOutIndex|0,
    pathEl: path,
    hoverEl: null,
  });

  // Prime initial position
  updatePreview(ev);

  window.addEventListener('pointermove', updatePreview, true);
  window.addEventListener('pointerup', onPointerUp, true);
}

/* ---------- one-time style injection for overlay + indicators ---------- */
(function injectLinkingCss(){
  const id = 'kadie-linking-style';
  if (document.getElementById(id)) return;
  const css = `
    /* Dim all nodes during linking */
    .linking-mode .node { filter: grayscale(.35) saturate(.6) opacity(.9); }
    /* Matching input pins stand out */
    .linking-mode .port.pin-match { filter: none; }
    .linking-mode .port.pin-match .portDot { transform: scale(1.08); }

    /* Hover + result borders */
    .port.pin-hover { outline: 1px solid rgba(255,255,255,.22); }
    .port.pin-ok  { outline-color: rgba(86,196,132,.75); }
    .port.pin-bad { outline-color: rgba(231,76,60,.8); }
  `;
  const el = document.createElement('style'); el.id = id; el.textContent = css; document.head.appendChild(el);
})();
