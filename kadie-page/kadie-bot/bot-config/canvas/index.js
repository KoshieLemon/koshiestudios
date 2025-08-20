// canvas/index.js — viewport + rendering + DnD integration
import { dom, view } from "./env.js";
import { applyTransform, buildDom, wirePanZoom, wireDeleteKey, centerOnGraph } from "./view.js";
import { wireDropAdd } from "./dnd.js";
import { state, markDirty, historyPush } from "../state.js";
import { createNodeEl, ensureNodeDefaults } from "./nodes.js";
import { createEdgeEl } from "./edges.js";
import { normalizePortsFromElement } from "./types.js";

function elCanvas() {
  return document.querySelector("#canvas")
      || document.querySelector("[data-blueprint-viewport]")
      || document.querySelector(".blueprint-viewport");
}

/** Build viewport once. Subsequent calls are idempotent. */
export function renderAll(){
  const root = elCanvas();
  if (!root) return;

  // Build persistent DOM containers
  buildDom(root);
  wirePanZoom(root);
  wireDeleteKey();
  wireDropAdd(root);

  // Initial transform
  applyTransform();

  renderGraph();
  centerOnGraph();
}

/** Only redraw nodes and edges. Do not touch the viewport DOM. */
export function renderGraph(){
  if (!dom.nodes || !dom.svg) return;
  dom.nodes.innerHTML = "";
  dom.svg.innerHTML = "";

  const nodes = Array.isArray(state.graph?.nodes) ? state.graph.nodes : [];
  const edges = Array.isArray(state.graph?.edges) ? state.graph.edges : [];

  for (const n of nodes) createNodeEl(n);
  for (const e of edges) createEdgeEl(e);
}

/** Compute a free spawn position that avoids overlap. */
function rectsOverlap(a,b){
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}
function findSpawn(x, y, w, h){
  const nodes = Array.isArray(state.graph?.nodes) ? state.graph.nodes : [];
  let pos = { x: x - w/2, y: y - h/2 };
  const step = 24, limit = 40;
  if (!nodes.length) return pos;

  let dx = 0, dy = 0, leg = 1, dir = 0, steps = 1;
  const rect = (px,py) => ({ x: px, y: py, w, h });

  for (let i=0; i<limit; i++){
    const test = rect(pos.x + dx, pos.y + dy);
    let collides = false;
    for (const n of nodes){
      const nb = { x:n.x, y:n.y, w:n.w||260, h:n.h||120 };
      if (rectsOverlap(test, nb)){ collides = true; break; }
    }
    if (!collides) return { x: test.x, y: test.y };

    switch(dir){
      case 0: dx += step; break;
      case 1: dy += step; break;
      case 2: dx -= step; break;
      case 3: dy -= step; break;
    }
    if (--steps === 0){ dir = (dir+1) & 3; if (dir===0||dir===2) leg++; steps = leg; }
  }
  return { x: pos.x + dx, y: pos.y + dy };
}

/** Add a node to the graph from an element meta object. */
export function addNodeFromElement(elMeta, xOrPos, y2){
  const { inputs, outputs } = normalizePortsFromElement(elMeta || {});
  const portCount = Math.max(inputs.length, outputs.length);
  const w = 260;
  const h = Math.max(100, 48 + portCount * 24);

  let x, y;
  if (typeof xOrPos === 'object' && xOrPos) { x = xOrPos.x; y = xOrPos.y; }
  else { x = xOrPos; y = y2; }

  if (!Number.isFinite(x) || !Number.isFinite(y)){
    const r = (dom.vp || elCanvas()).getBoundingClientRect();
    x = r.width / 2;
    y = r.height / 2;
  }

  historyPush("add-node");

  const pos = findSpawn(x, y, w, h);
  const node = {
    id: (crypto?.randomUUID ? crypto.randomUUID() : ('n_' + Math.random().toString(36).slice(2))),
    name: String(elMeta?.name || elMeta?.id || "Element"),
    elId: String(elMeta?.id || elMeta?.name || "element"),
    element: elMeta || {},
    inputs, outputs,
    params: JSON.parse(JSON.stringify(elMeta?.params || {})),
    x: pos.x, y: pos.y, w, h,
  };
  ensureNodeDefaults(node);

  (state.graph.nodes ||= []).push(node);
  createNodeEl(node);

  markDirty("addNodeFromElement");
  window.dispatchEvent(new Event("bp:graph-changed"));
  return node;
}

/** Viewport helpers for save/load UI state */
export function getViewport(){
  try { return { tx: (view.tx||0), ty: (view.ty||0), scale: (view.scale||1) }; } catch { return { tx:0, ty:0, scale:1 }; }
}
export function setViewport(vp){
  try {
    if (!vp || typeof vp !== 'object') return;
    if (Number.isFinite(vp.tx)) view.tx = vp.tx;
    if (Number.isFinite(vp.ty)) view.ty = vp.ty;
    if (Number.isFinite(vp.scale) && vp.scale>0) view.scale = vp.scale;
    applyTransform();
  } catch {}
}

/** Snapshot UI state (node rects + viewport) for persistence */
export function snapshotUI(){
  const nodes = {};
  const list = Array.isArray(state.graph?.nodes) ? state.graph.nodes : [];
  for (const n of list){
    nodes[n.id] = { x: n.x|0, y: n.y|0, w: n.w|0, h: n.h|0, z: n.z|0 };
  }
  return { nodes, viewport: getViewport() };
}
