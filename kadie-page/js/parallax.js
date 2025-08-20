// Parallax that PRESERVES base transforms (Kadie stays perfectly centered).
(function(){
  const scene = document.getElementById('scene');
  if (!scene) return;

  const RANGE_X = 80, RANGE_Y = 60;
  const els = Array.from(new Set([
    ...scene.querySelectorAll('[data-depth]'),
    ...scene.querySelectorAll('.message-layer'),
    ...scene.querySelectorAll('.line-layer'),
    ...scene.querySelectorAll('.fx-layer')
  ]));

  const base = new Map();
  for (const el of els){
    const cs = getComputedStyle(el);
    base.set(el, (cs.transform && cs.transform !== 'none') ? cs.transform : '');
  }

  const blurPx = el => {
    const d = parseFloat(el.dataset?.blur || '');
    if (Number.isFinite(d)) return d;
    const m = (getComputedStyle(el).filter || '').match(/blur\(([\d.]+)px\)/);
    return m ? parseFloat(m[1]) : 0;
  };
  const depth = el => Number.parseFloat(el.dataset?.depth || '0') || 0;
  const eff   = el => depth(el) * (1 / (1 + blurPx(el)*0.1));

  const state = { kx:0, ky:0 };
  function paint(){
    for (const el of els){
      const t = `translate3d(${-state.kx*eff(el)}px, ${-state.ky*eff(el)}px, 0)`;
      const b = base.get(el) || '';
      el.style.transform = (b ? b+' ' : '') + t;
    }
  }
  scene.addEventListener('mousemove', e=>{
    const r = scene.getBoundingClientRect();
    state.kx = ((e.clientX - (r.left+r.width/2)) / r.width)  * RANGE_X;
    state.ky = ((e.clientY - (r.top +r.height/2)) / r.height) * RANGE_Y;
    requestAnimationFrame(paint);
  }, { passive:true });

  requestAnimationFrame(paint);
})();
