export function waitForTransitions(map, onAllDone) {
  let remaining = Object.keys(map).length;
  const off = [];
  const check = (ev) => {
    const cfg = Object.values(map).find(c => c.el === ev.currentTarget);
    if (!cfg) return;
    if (ev.propertyName !== cfg.prop) return;
    ev.currentTarget.removeEventListener('transitionend', check);
    remaining -= 1;
    if (remaining <= 0) onAllDone();
  };
  Object.values(map).forEach(({ el }) => {
    el.addEventListener('transitionend', check);
    off.push(() => el.removeEventListener('transitionend', check));
  });
  return () => { off.forEach(fn => fn()); onAllDone(); };
}

export function readCSSms(varName, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  if (!v) return fallback;
  if (v.endsWith('ms')) return parseFloat(v);
  if (v.endsWith('s')) return parseFloat(v) * 1000;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}
