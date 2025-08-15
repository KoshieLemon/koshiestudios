// canvas/index.js — viewport wiring, render, spawn, non-overlap, and legacy APIs.
import { dom } from "./env.js";
import { applyTransform, buildDom, wirePanZoom, wireDeleteKey, centerOnGraph } from "./view.js";
import { state, markDirty, historyPush } from "../state.js";
import { createNodeEl, ensureNodeDefaults } from "./nodes.js";
import { createEdgeEl } from "./edges.js";
import { normalizePortsFromElement } from "./types.js";

function elCanvas() {
  // Keep compatibility with your markup: prefer explicit #canvas
  return document.querySelector("#canvas") ||
         document.querySelector("[data-blueprint-viewport]") ||
         document.querySelector(".blueprint-viewport");
}

export function renderAll(){
  const root = elCanvas();
  root.innerHTML = "";
  root.style.position = "relative";

  buildDom(root);
  applyTransform();
  wirePanZoom();
  wireDeleteKey();

  renderGraph();
  centerOnGraph();

  // Re-render on graph changes (undo/redo, etc.)
  window.addEventListener("bp:graph-changed", renderGraph);
}

export function renderGraph(){
  dom.nodes.innerHTML = "";
  dom.svg.innerHTML = "";
  const nodes = state.graph?.nodes || [];
  const edges = state.graph?.edges || [];
  for (const n of nodes) createNodeEl(n);
  for (const e of edges) createEdgeEl(e);
}

// ---- Spawn helpers ----------------------------------------------------------

function rectsOverlap(a,b){
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}
function findSpawn(x, y, w=260, h=100){
  const nodes = state.graph?.nodes || [];
  let nx = Number.isFinite(x) ? x : 80;
  let ny = Number.isFinite(y) ? y : 60;

  const step = 24;
  const target = { x:nx, y:ny, w, h };

  for (let tries=0; tries<256; tries++){
    let collide = false;
    for (const n of nodes){
      const r = { x:+n.x||0, y:+n.y||0, w:+n.w||200, h:+n.h||100 };
      if (rectsOverlap(target, r)){ collide = true; break; }
    }
    if (!collide) break;
    const dir = tries % 4;
    if (dir===0) nx += step;
    if (dir===1) ny += step;
    if (dir===2) nx -= step*2;
    if (dir===3) ny -= step*2;
    target.x = nx; target.y = ny;
  }
  return { x:nx, y:ny };
}

function uid(p='n_'){ return p + Math.random().toString(36).slice(2,9); }

// Legacy API used by ui-elements.js and DnD
export function addNodeFromElement(elMeta, x, y){
  // IMPORTANT: API requires a 'type' field; use meta.id/name if missing.
  const nodeType = elMeta.type || elMeta.id || elMeta.name || "Node";

  const { inputs = [], outputs = [] } = normalizePortsFromElement(elMeta);
  const portCount = Math.max(inputs.length, outputs.length);
  const w = 260;
  const h = Math.max(100, 48 + portCount * 24);

  // Default to viewport center if coords not provided
  if (!Number.isFinite(x) || !Number.isFinite(y)){
    const r = dom.vp.getBoundingClientRect();
    x = r.width / 2;
    y = r.height / 2;
  }

  // Save history BEFORE mutating graph
  historyPush("add-node");

  const pos = findSpawn(x, y, w, h);
  const node = {
    id: uid("n_"),
    type: nodeType,               // <-- Fixes 422 "Field required: type"
    name: elMeta.name || elMeta.id || nodeType,
    title: elMeta.name || elMeta.id || nodeType,
    inputs,
    outputs,
    params: JSON.parse(JSON.stringify(elMeta.params || {})),
    x: pos.x, y: pos.y, w, h
  };
  ensureNodeDefaults(node);

  (state.graph.nodes ||= []).push(node);
  createNodeEl(node);

  markDirty("addNodeFromElement");
  window.dispatchEvent(new Event("bp:graph-changed"));
  return node;
}
