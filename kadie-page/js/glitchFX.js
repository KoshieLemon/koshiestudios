// glitchFX.js — lightweight, non-invasive message FX:
// - glitch-in on spawn
// - random tiny text jitter while alive
// - glitch-out ghost when a message is removed

(() => {
  const LAYER_IDS = ['messageLayerBack','messageLayerMid','messageLayerFront','messageLayerOver'];
  const timers = new WeakMap();

  function rnd(min, max){ return Math.random() * (max - min) + min; }

  function prepareMsg(el){
    if (!(el instanceof Element)) return;
    // entrance warp
    el.style.setProperty('--kd-skx', `${rnd(-2,2).toFixed(2)}deg`);
    el.classList.add('kd-glitch-in');
    el.addEventListener('animationend', (ev)=>{
      if (ev.animationName === 'kd-glitch-in') el.classList.remove('kd-glitch-in');
    }, { once:true });

    // random jitter pings
    scheduleJitter(el);
  }

  function scheduleJitter(el){
    // use recursive timeouts for varied cadence
    function arm(){
      const t = setTimeout(() => {
        if (!document.body.contains(el)) return;
        el.classList.add('kd-jitter');
        setTimeout(()=> el.classList.remove('kd-jitter'), 120);
        arm();
      }, rnd(1200, 4200));
      timers.set(el, t);
    }
    // avoid double-arming
    if (!timers.has(el)) arm();
  }

  function cleanup(el){
    const t = timers.get(el);
    if (t) clearTimeout(timers.get(el));
    timers.delete(el);
  }

  function ghostOut(el){
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const ghost = el.cloneNode(true);
    Object.assign(ghost.style, {
      position:'fixed', left:`${r.left}px`, top:`${r.top}px`,
      width:`${r.width}px`, height:`${r.height}px`,
      margin:'0', pointerEvents:'none', zIndex: 99999
    });
    ghost.classList.add('kd-glitch-out');
    document.body.appendChild(ghost);
    ghost.addEventListener('animationend', ()=> ghost.remove(), { once:true });
  }

  function onAdded(node){
    if (!(node instanceof Element)) return;
    if (node.classList.contains('dmsg')) prepareMsg(node);
    node.querySelectorAll?.('.dmsg')?.forEach(prepareMsg);
  }

  function onRemoved(node){
    if (!(node instanceof Element)) return;
    const list = [];
    if (node.classList?.contains('dmsg')) list.push(node);
    node.querySelectorAll?.('.dmsg')?.forEach(n => list.push(n));
    list.forEach(el => { cleanup(el); ghostOut(el); });
  }

  function boot(){
    const layers = LAYER_IDS.map(id => document.getElementById(id)).filter(Boolean);
    if (!layers.length) { requestAnimationFrame(boot); return; }

    // existing messages (if any)
    layers.forEach(L => L.querySelectorAll('.dmsg').forEach(prepareMsg));

    // observe for changes
    const mo = new MutationObserver(muts => {
      for (const m of muts){
        m.addedNodes && m.addedNodes.forEach(onAdded);
        m.removedNodes && m.removedNodes.forEach(onRemoved);
      }
    });
    layers.forEach(L => mo.observe(L, { childList:true, subtree:true }));
  }

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot);
  else boot();
})();
