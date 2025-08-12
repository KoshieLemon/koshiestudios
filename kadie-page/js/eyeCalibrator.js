// Eye + Hair Calibrator — rock solid drag & keyboard controls
// - Click pill or press "E" to toggle
// - Drag L/R/H1/H2 to move; scroll to resize (Shift = fine)
// - Keyboard: select a handle (click or Tab), then:
//     Arrow keys = move; PageUp/PageDown = resize; hold Shift = fine step
// - Saves CSS vars on .kadie-wrap via localStorage

const KEY = 'kadieEyeConfig';

(function boot(){
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    setTimeout(init, 0);
  }
})();

function init(){
  const wrap  = document.getElementById('kadieWrap') || document.querySelector('.kadie-wrap');
  const eyeL  = document.getElementById('kadieEyeLeft')  || document.querySelector('.eye-left');
  const eyeR  = document.getElementById('kadieEyeRight') || document.querySelector('.eye-right');
  const hair1 = document.getElementById('kadieHair01')   || document.querySelector('.hair-01.base');
  const hair2 = document.getElementById('kadieHair02')   || document.querySelector('.hair-02.base');

  if (!wrap){
    console.warn('[Kadie Cal] No .kadie-wrap found; calibrator idle.');
    return;
  }

  // Create/replace toggle button
  let btn = document.getElementById('eyeCalBtn');
  if (btn) btn.remove();
  btn = document.createElement('div');
  btn.id = 'eyeCalBtn';
  btn.textContent = 'Calibrate Eyes + Hair';
  document.body.appendChild(btn);
  Object.assign(btn.style, {
    position:'fixed', right:'14px', bottom:'14px', zIndex:'200000',
    background:'rgba(20,24,40,.85)', color:'#d6e1ff',
    border:'1px solid rgba(120,150,255,.35)', borderRadius:'999px',
    padding:'10px 14px', fontWeight:'700', cursor:'pointer',
    userSelect:'none', backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)',
    boxShadow:'0 8px 30px rgba(0,0,0,.45)'
  });
  btn.addEventListener('pointerenter', ()=>{ btn.style.background='rgba(30,36,60,.95)'; });
  btn.addEventListener('pointerleave', ()=>{ btn.style.background='rgba(20,24,40,.85)'; });

  console.info('[Kadie Cal] Ready. Click the pill or press E to toggle.');
  btn.addEventListener('click', toggle);
  window.addEventListener('keydown', (e)=>{
    if ((e.key||'').toLowerCase()==='e' && !e.metaKey && !e.ctrlKey && !e.altKey){
      e.preventDefault(); toggle();
    }
  });
  window.KADIE_CAL = { toggle };

  let overlay=null, handles={}, working=null, activeKey=null;

  function toggle(){ overlay ? close() : open(); }

  function open(){
    working = readCurrent(wrap);

    overlay = document.createElement('div');
    overlay.className = 'eye-cal-overlay';
    Object.assign(overlay.style, {
      position:'fixed', inset:'0', zIndex:'200050',
      pointerEvents:'none' // overlay visual layer never intercepts events
    });

    // Dim (visual only)
    const dim = document.createElement('div');
    Object.assign(dim.style, {
      position:'absolute', inset:'-20px',
      background:'radial-gradient(60% 50% at 50% 50%, rgba(0,0,0,.0) 40%, rgba(0,0,0,.55) 100%)',
      pointerEvents:'none', zIndex:'0'
    });
    overlay.appendChild(dim);

    // Panel (interactive)
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      position:'absolute', right:'12px', top:'12px', display:'flex', gap:'8px', zIndex:'3',
      pointerEvents:'auto'
    });
    panel.appendChild(makeBtn('Copy', copyCSS));
    panel.appendChild(makeBtn('Reset', doReset));
    panel.appendChild(makeBtn('Save', doSave));
    panel.appendChild(makeBtn('Close', close));
    overlay.appendChild(panel);

    // Hint
    const hint = document.createElement('div');
    hint.textContent = 'Drag L/R/H1/H2 • Scroll=resz (Shift=fine) • Arrows=move, PgUp/PgDn=resize • E=toggle';
    Object.assign(hint.style, {
      position:'absolute', left:'50%', transform:'translateX(-50%)', bottom:'12px',
      color:'#cfe0ff', background:'rgba(20,24,40,.75)', border:'1px solid rgba(120,150,255,.35)',
      padding:'6px 10px', borderRadius:'8px', fontSize:'12px', whiteSpace:'nowrap',
      zIndex:'3', pointerEvents:'auto'
    });
    overlay.appendChild(hint);

    // Handle layer
    const handleLayer = document.createElement('div');
    Object.assign(handleLayer.style, {
      position:'absolute', inset:'0', zIndex:'2', pointerEvents:'none'
    });
    overlay.appendChild(handleLayer);

    document.body.appendChild(overlay);

    // Create handles only for elements that exist
    if (eyeL) handles.left  = createHandle(handleLayer, 'L',  'left',  working.left);
    if (eyeR) handles.right = createHandle(handleLayer, 'R',  'right', working.right);
    if (hair1)handles.h1    = createHandle(handleLayer, 'H1', 'h1',    working.h1);
    if (hair2)handles.h2    = createHandle(handleLayer, 'H2', 'h2',    working.h2);

    window.addEventListener('resize', syncHandles);
    // Global keyboard for nudging the active handle
    window.addEventListener('keydown', onKeyNudge, { capture:true });
  }

  function close(){
    if (!overlay) return;
    window.removeEventListener('resize', syncHandles);
    window.removeEventListener('keydown', onKeyNudge, true);
    overlay.remove(); overlay=null; handles={}; activeKey=null;
  }

  function makeBtn(label, onClick){
    const b = document.createElement('button');
    b.textContent = label;
    Object.assign(b.style, {
      background:'rgba(20,24,40,.85)', color:'#d6e1ff', border:'1px solid rgba(120,150,255,.35)',
      padding:'8px 10px', borderRadius:'8px', fontWeight:'700', cursor:'pointer',
      backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)'
    });
    b.addEventListener('pointerenter', ()=>{ b.style.background='rgba(30,36,60,.95)'; });
    b.addEventListener('pointerleave', ()=>{ b.style.background='rgba(20,24,40,.85)'; });
    b.addEventListener('click', onClick);
    b.style.pointerEvents='auto';
    return b;
  }

  function createHandle(layer, label, key, pos){
    const h = document.createElement('div');
    h.textContent = label;
    Object.assign(h.style, {
      position:'absolute', width:'44px', height:'44px', borderRadius:'50%',
      border:'2px solid rgba(120,160,255,.9)', background:'rgba(30,40,80,.75)',
      boxShadow:'0 6px 22px rgba(0,0,0,.45)', color:'#cfe0ff',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontWeight:'900', cursor:'grab', userSelect:'none',
      zIndex:'2', pointerEvents:'auto', touchAction:'none',
      outline:'none'
    });
    h.setAttribute('role','button');
    h.setAttribute('tabindex','0');
    h.dataset.key = key;
    layer.appendChild(h);

    setHandle(h, pos);

    // Click/focus selects active handle for keyboard nudging
    h.addEventListener('pointerdown', ()=>{ activeKey = key; });
    h.addEventListener('focus', ()=>{ activeKey = key; });

    // --- Robust dragging (document-level listeners) ---
    let dragging=false, last = null;

    const onDown = (e)=>{
      e.preventDefault(); e.stopPropagation();
      dragging = true; last = { x:e.clientX, y:e.clientY };
      h.setPointerCapture?.(e.pointerId);
      h.style.cursor='grabbing';
      // attach doc-level move/up so we keep receiving events no matter what
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
      window.addEventListener('pointercancel', onUp, true);
    };
    const onMove = (e)=>{
      if (!dragging) return;
      const r = wrap.getBoundingClientRect();
      if (r.width<=0 || r.height<=0) return;
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      last = { x:e.clientX, y:e.clientY };

      const cur = working[key];
      const nx = clamp(cur.x + (dx / r.width)  * 100, 0, 100);
      const ny = clamp(cur.y + (dy / r.height) * 100, 0, 100);
      working[key] = { x:nx, y:ny, w:cur.w };
      setHandle(h, working[key]);
      ghostApply(wrap, key, working[key]);
    };
    const onUp = ()=>{
      dragging=false; h.style.cursor='grab';
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
    };

    h.addEventListener('pointerdown', onDown);

    // Scroll to resize (Shift = fine)
    h.addEventListener('wheel', (e)=>{
      e.preventDefault(); e.stopPropagation();
      const cur = working[key];
      const step = (e.shiftKey ? 0.2 : 1.0) * (e.deltaY < 0 ? 1 : -1);
      const nw = clamp(cur.w + step, 5, 80);
      working[key] = { x:cur.x, y:cur.y, w:nw };
      setHandle(h, working[key]);
      ghostApply(wrap, key, working[key]);
    }, { passive:false });

    return h;
  }

  // Keyboard nudge for selected handle
  function onKeyNudge(e){
    if (!activeKey || !overlay) return;
    const cur = working[activeKey]; if (!cur) return;

    let dx=0, dy=0, dw=0;
    const fine = e.shiftKey ? 0.2 : 1.0;

    switch (e.key){
      case 'ArrowLeft':  dx = -fine; break;
      case 'ArrowRight': dx =  fine; break;
      case 'ArrowUp':    dy = -fine; break;
      case 'ArrowDown':  dy =  fine; break;
      case 'PageUp':     dw =  fine; break;
      case 'PageDown':   dw = -fine; break;
      default: return;
    }
    e.preventDefault(); e.stopPropagation();

    const nxt = {
      x: clamp(cur.x + dx, 0, 100),
      y: clamp(cur.y + dy, 0, 100),
      w: clamp(cur.w + dw, 5, 80)
    };
    working[activeKey] = nxt;
    // Update visuals
    const h = handleByKey(activeKey);
    if (h) setHandle(h, nxt);
    ghostApply(wrap, activeKey, nxt);
  }

  function handleByKey(k){
    if (!handles) return null;
    if (k==='left')  return handles.left || null;
    if (k==='right') return handles.right || null;
    if (k==='h1')    return handles.h1 || null;
    if (k==='h2')    return handles.h2 || null;
    return null;
  }

  function setHandle(h, pos){
    const r = wrap.getBoundingClientRect();
    const px = r.left + (pos.x/100) * r.width;
    const py = r.top  + (pos.y/100) * r.height;
    h.style.left = (px - 22) + 'px';
    h.style.top  = (py - 22) + 'px';
  }

  function syncHandles(){
    if (!overlay) return;
    if (handles.left)  setHandle(handles.left,  working.left);
    if (handles.right) setHandle(handles.right, working.right);
    if (handles.h1)    setHandle(handles.h1,    working.h1);
    if (handles.h2)    setHandle(handles.h2,    working.h2);
  }

  function doSave(){ save(working); apply(wrap, working); close(); }
  function doReset(){
    localStorage.removeItem(KEY);
    working = readDefault();
    if (handles.left)  setHandle(handles.left,  working.left);
    if (handles.right) setHandle(handles.right, working.right);
    if (handles.h1)    setHandle(handles.h1,    working.h1);
    if (handles.h2)    setHandle(handles.h2,    working.h2);
    apply(wrap, working);
  }
  function copyCSS(){
    const css = cssSnippet(working);
    navigator.clipboard?.writeText(css).catch(()=>{});
    console.info('[Kadie Cal] Copied CSS:\n' + css);
  }
}

/* ------------ Config + Apply ------------ */

function readCurrent(wrap){
  const cs = getComputedStyle(wrap);
  const num = (v, fb) => { const n=parseFloat(v); return Number.isFinite(n)?n:fb; };
  const stored = load();
  const base = {
    left:  { x:num(cs.getPropertyValue('--eyeL-left'),  41.5), y:num(cs.getPropertyValue('--eyeL-top'), 41.2), w:num(cs.getPropertyValue('--eyeL-width'), 21.0) },
    right: { x:num(cs.getPropertyValue('--eyeR-left'),  58.5), y:num(cs.getPropertyValue('--eyeR-top'), 41.2), w:num(cs.getPropertyValue('--eyeR-width'), 21.0) },
    h1:    { x:num(cs.getPropertyValue('--hair1-left'), 36.0), y:num(cs.getPropertyValue('--hair1-top'), 54.0), w:num(cs.getPropertyValue('--hair1-width'), 36.0) },
    h2:    { x:num(cs.getPropertyValue('--hair2-left'), 64.0), y:num(cs.getPropertyValue('--hair2-top'), 54.0), w:num(cs.getPropertyValue('--hair2-width'), 36.0) },
  };
  if (!stored) return base;
  return {
    left:  stored.left  ?? base.left,
    right: stored.right ?? base.right,
    h1:    stored.h1    ?? base.h1,
    h2:    stored.h2    ?? base.h2,
  };
}

function readDefault(){
  return {
    left:  { x:41.5, y:41.2, w:21.0 },
    right: { x:58.5, y:41.2, w:21.0 },
    h1:    { x:36.0, y:54.0, w:36.0 },
    h2:    { x:64.0, y:54.0, w:36.0 },
  };
}

function apply(wrap, cfg){
  wrap.style.setProperty('--eyeL-left',  cfg.left.x  + '%');
  wrap.style.setProperty('--eyeL-top',   cfg.left.y  + '%');
  wrap.style.setProperty('--eyeL-width', cfg.left.w  + '%');
  wrap.style.setProperty('--eyeR-left',  cfg.right.x + '%');
  wrap.style.setProperty('--eyeR-top',   cfg.right.y + '%');
  wrap.style.setProperty('--eyeR-width', cfg.right.w  + '%');

  wrap.style.setProperty('--hair1-left',  cfg.h1.x  + '%');
  wrap.style.setProperty('--hair1-top',   cfg.h1.y  + '%');
  wrap.style.setProperty('--hair1-width', cfg.h1.w  + '%');
  wrap.style.setProperty('--hair2-left',  cfg.h2.x  + '%');
  wrap.style.setProperty('--hair2-top',   cfg.h2.y  + '%');
  wrap.style.setProperty('--hair2-width', cfg.h2.w  + '%');
}

function ghostApply(wrap, which, pos){
  const map = {
    left:  ['--eyeL-left','--eyeL-top','--eyeL-width'],
    right: ['--eyeR-left','--eyeR-top','--eyeR-width'],
    h1:    ['--hair1-left','--hair1-top','--hair1-width'],
    h2:    ['--hair2-left','--hair2-top','--hair2-width'],
  }[which];
  if (!map) return;
  wrap.style.setProperty(map[0], pos.x + '%');
  wrap.style.setProperty(map[1], pos.y + '%');
  wrap.style.setProperty(map[2], pos.w + '%');
}

function cssSnippet(cfg){
  return `
/* Paste into kadie.css to lock your calibration */
.kadie-wrap{
  --eyeL-left: ${cfg.left.x}%;
  --eyeL-top: ${cfg.left.y}%;
  --eyeL-width: ${cfg.left.w}%;

  --eyeR-left: ${cfg.right.x}%;
  --eyeR-top: ${cfg.right.y}%;
  --eyeR-width: ${cfg.right.w}%;

  --hair1-left: ${cfg.h1.x}%;
  --hair1-top: ${cfg.h1.y}%;
  --hair1-width: ${cfg.h1.w}%;

  --hair2-left: ${cfg.h2.x}%;
  --hair2-top: ${cfg.h2.y}%;
  --hair2-width: ${cfg.h2.w}%;
}`.trim();
}

/* ------------ Storage + Utils ------------ */
function load(){ try{ return JSON.parse(localStorage.getItem(KEY) || 'null'); }catch{ return null; } }
function save(cfg){ localStorage.setItem(KEY, JSON.stringify(cfg)); }
function clamp(v,a,b){ return v<a?a : (v>b?b:v); }