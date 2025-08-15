// Shared mutable singletons for cross-module access.

export const dom = {
  vp: null,       // viewport container (receives pan/zoom input)
  content: null,  // transformed content wrapper
  svg: null,      // edges layer (svg)
  nodes: null,    // nodes layer (div)
  ctx: null,
};

export const view = {
  scale: 1,
  tx: 0,
  ty: 0,
};

export const selection = { nodeId: '', edgeId: '' };

// Drag state used by nodes.js (keep names consistent!)
export const dragging = {
  nodeId: '',
  active: false,
  startX: 0,
  startY: 0,
  nodeStartX: 0,
  nodeStartY: 0,
  vx: 0,   // smoothed instantaneous drag velocity (canvas space)
  vy: 0,
};

// Current in-progress link (from OUT pin to IN pin)
let _linking = null;
export function setLinking(v){ _linking = v; }
export function getLinking(){ return _linking; }
