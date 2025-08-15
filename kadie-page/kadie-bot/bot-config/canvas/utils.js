import { view, dom } from './env.js';

export function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
export function deepCopy(o){ return JSON.parse(JSON.stringify(o)); }
export function cssEscape(s){ return String(s).replace(/[^a-zA-Z0-9_-]/g, ch => '\\'+ch.charCodeAt(0).toString(16)+' '); }
export function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

// Bezier path for a wire
export function wireD(x1,y1,x2,y2){
  const dx = Math.abs(x2-x1);
  const k = Math.max(60, dx*0.6);
  const c1x = x1 + k, c1y = y1;
  const c2x = x2 - k, c2y = y2;
  return `M ${x1},${y1} C ${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`;
}

// Convert a port (dir=in/out, portIndex) to canvas local coordinates
export function portLocalXY(nodeEl, dir, portIdx){
  const p = nodeEl?.querySelectorAll('.port.'+dir)?.[portIdx|0];
  const rect = p?.getBoundingClientRect?.();
  const cRect = dom.nodes?.getBoundingClientRect?.();
  if (rect && cRect) {
    const x = (rect.left - cRect.left - 0 - 0) / view.scale + rect.width/2 + (-view.tx/view.scale);
    const y = (rect.top  - cRect.top  - 0 - 0) / view.scale + rect.height/2 + (-view.ty/view.scale);
    // Adjust for current transform: because we compute relative to canvas and then undo the transform
    return { x, y };
  }
  // fallback
  const nRect = nodeEl?.getBoundingClientRect?.();
  if (nRect && cRect) {
    const nx = (nRect.left - cRect.left - view.tx) / view.scale;
    const ny = (nRect.top  - cRect.top  - view.ty) / view.scale;
    return { x: nx + (dir==='out' ? (nodeEl?.offsetWidth||180) : 0), y: ny + 20 + (portIdx*22) };
  }
  return { x:0, y:0 };
}
