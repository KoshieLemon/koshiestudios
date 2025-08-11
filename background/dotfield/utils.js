export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export function gaussianFalloff(r, rMax) {
  // smooth, nearly zero at r=rMax (prevents “edge pull”)
  const r2 = r * r, R2 = rMax * rMax;
  return Math.exp(-(r2) / (R2 * 0.55));
}

export function readTransformOriginPx(el, rect) {
  const cs = getComputedStyle(el);
  const [oxRaw, oyRaw] = cs.transformOrigin.split(' ');
  const toPx = (raw, size) => raw.endsWith('%') ? (parseFloat(raw) / 100) * size : parseFloat(raw);
  return {
    x: rect.left + toPx(oxRaw, rect.width),
    y: rect.top  + toPx(oyRaw, rect.height),
    matrix: new DOMMatrix(cs.transform === 'none' ? undefined : cs.transform)
  };
}