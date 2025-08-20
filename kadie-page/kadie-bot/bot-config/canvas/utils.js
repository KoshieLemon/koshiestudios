// Utils: geometry, paths, DOM helpers

export function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]
  ));
}

export function cssEscape(s){
  return String(s).replace(/["\\#.;:>/<]/g, c => '\\' + c);
}

/** Clamp value into [min,max] */
export function clamp(v, min, max){
  return Math.max(min, Math.min(max, v));
}

/** Linear interpolation */
export function lerp(a,b,t){ return a + (b-a)*t; }

// Cubic wire path in world coordinates
export function wireD(x1, y1, x2, y2){
  const dx = Math.max(24, Math.abs(x2 - x1) * 0.5);
  const c1x = x1 + dx, c1y = y1;
  const c2x = x2 - dx, c2y = y2;
  return `M ${x1} ${y1} C ${c1x} ${c1y} ${c2x} ${c2y} ${x2} ${y2}`;
}

// Return the .port element for a node/dir/index
export function getPortEl(nodeEl, dir, portIndex){
  if (!nodeEl) return null;
  const sel = `.port.${dir}[data-port-index="${portIndex|0}"]`;
  return nodeEl.querySelector(sel);
}

// Convert client XY to world coords using current view transform
export function clientXYToWorld(view, vpEl, cx, cy){
  const r = vpEl.getBoundingClientRect();
  const x = (cx - r.left - (view.tx||0)) / (view.scale||1);
  const y = (cy - r.top  - (view.ty||0)) / (view.scale||1);
  return { x, y };
}

// Get the world-space center of a port's dot
export function portLocalXY(nodeEl, dir, portIndex, view, vpEl){
  const port = getPortEl(nodeEl, dir, portIndex);
  if (!port) return { x:0, y:0 };
  const dot = port.querySelector('.portDot') || port;
  const b = dot.getBoundingClientRect();
  const cx = b.left + b.width/2;
  const cy = b.top  + b.height/2;
  return clientXYToWorld(view, vpEl, cx, cy);
}
