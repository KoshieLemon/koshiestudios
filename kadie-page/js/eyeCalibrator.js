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
    if (overlay) return;
    working = readCurrent(wrap);

    overlay = document.createElement('div');
    overlay.id = 'kadieCalOverlay';
    Object.assign(overlay.style, {
      position:'fixed', inset:'0', zIndex:'200001', pointerEvents:'none'
    });

    // Glass panel with buttons
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      position:'absolute', right:'14px', bottom:'64px', zIndex:'3', pointerEvents:'auto',
      background:'rgba(20,24,40,.8)', color:'#d6e1ff',
      border:'1px solid rgba(120,150,255,.35)', borderRadius:'12px',
      padding:'8px', display:'flex', gap:'8px', alignItems:'center',
      backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)'
    });
    const makeBtn = (label, fn)=>{
      const b = document.createElement('button');
      b.textContent = label;
      Object.assign(b.style, {
        all:'unset', cursor:'pointer', padding:'6px 10px', borderRadius:'8px',
        border:'1px solid rgba(120,150,255,.35)', background:'rgba(30,36,60,.85)',
        color:'#cfe0ff', fontWeight:'700'
      });
      b.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); fn(); });
      return b;
    };
    function copyCSS(){
      const css = cssText(working);
      navigator.clipboard?.writeText(css).catch(()=>{});
      panel.animate([{opacity:1},{opacity:.35},{opacity:1}], {duration:360});
    }
    function doReset(){
      working = readDefault();
      syncHandles(); ghostApplyAll(wrap, working);
    }
    function doSave(){
      apply(wrap, working); save(working);
      panel.animate([{opacity:1},{opacity:.35},{opacity:1}], {duration:360});
    }
    function close(){ if(!overlay) return; overlay.remove(); overlay=null; handles={}; activeKey=null; }

    // Expose close so toggle works
    window.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape' && overlay){ e.preventDefault(); close(); }
    }, { capture:true });

    Object.assign(panel.style, { pointerEvents:'auto' });
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

    syncHandles();
    ghostApplyAll(wrap, working);

    function onKeyNudge(e){
      if (!overlay || !activeKey) return;
      const cur = working[activeKey];
      let used = false;
      const fine = e.shiftKey ? 0.2 : 0.8;

      switch(e.key){
        case 'ArrowLeft':  working[activeKey] = {...cur, x: clamp(cur.x - fine, 0,100)}; used=true; break;
        case 'ArrowRight': working[activeKey] = {...cur, x: clamp(cur.x + fine, 0,100)}; used=true; break;
        case 'ArrowUp':    working[activeKey] = {...cur, y: clamp(cur.y - fine, 0,100)}; used=true; break;
        case 'ArrowDown':  working[activeKey] = {...cur, y: clamp(cur.y + fine, 0,100)}; used=true; break;
        case 'PageUp':     working[activeKey] = {...cur, w: clamp(cur.w + (e.shiftKey?0.2:1.0), 5,80)}; used=true; break;
        case 'PageDown':   working[activeKey] = {...cur, w: clamp(cur.w - (e.shiftKey?0.2:1.0), 5,80)}; used=true; break;
        case 'Tab': {
          e.preventDefault();
          const order = Object.keys(handles);
          if (!order.length) return;
          const idx = Math.max(0, order.indexOf(activeKey));
          const next = e.shiftKey ? (idx-1+order.length)%order.length : (idx+1)%order.length;
          setActive(order[next]);
          used = true;
          break;
        }
      }
      if (used){
        e.preventDefault();
        const h = handles[activeKey];
        setHandle(h, working[activeKey]);
        ghostApply(wrap, activeKey, working[activeKey]);
      }
    }

    function createHandle(layer, label, key, cfg){
      const h = document.createElement('button');
      h.type='button';
      h.setAttribute('data-key', key);
      h.textContent = label;
      Object.assign(h.style, {
        position:'absolute', transform:'translate(-50%,-50%)',
        width:'36px', height:'36px', borderRadius:'50%',
        background:'rgba(60,80,140,.9)', color:'#fff',
        border:'1px solid rgba(140,170,255,.55)', boxShadow:'0 6px 22px rgba(0,0,0,.45)',
        fontWeight:'900', fontSize:'14px', cursor:'grab', userSelect:'none',
        pointerEvents:'auto'
      });

      h.addEventListener('click', (e)=>{ e.preventDefault(); setActive(key); });
      h.addEventListener('pointerdown', onDown);

      setHandle(h, cfg);
      layer.appendChild(h);
      return h;

      function onDown(e){
        e.preventDefault(); e.stopPropagation();
        setActive(key);
        let last = { x:e.clientX, y:e.clientY };
        let dragging = true;
        h.setPointerCapture(e.pointerId);
        h.style.cursor='grabbing';

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

        window.addEventListener('pointermove', onMove, true);
        window.addEventListener('pointerup', onUp, true);
        window.addEventListener('pointercancel', onUp, true);
      }
    }

    function setActive(key){
      activeKey = key;
      for (const k in handles){
        handles[k].style.outline = (k===key) ? '3px solid rgba(140,170,255,.9)' : 'none';
        handles[k].style.zIndex = (k===key) ? '5' : '4';
      }
    }

    function setHandle(h, cfg){
      const r = wrap.getBoundingClientRect();
      h.style.left = (r.left + (cfg.x/100)*r.width) + 'px';
      h.style.top  = (r.top  + (cfg.y/100)*r.height) + 'px';
      h.style.width = h.style.height = Math.max(28, Math.min(44, (cfg.w/100)*r.width*0.18)) + 'px';
    }

    function syncHandles(){
      if (!overlay) return;
      for (const k in handles){
        setHandle(handles[k], working[k]);
      }
    }
  } // open()

  function close(){
    const ov = document.getElementById('kadieCalOverlay');
    if (ov) ov.remove();
    overlay=null; handles={}; activeKey=null;
  }
}

/* ------------ Config read/apply helpers ------------ */
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
  wrap.style.setProperty('--eyeR-width', cfg.right.w + '%');

  wrap.style.setProperty('--hair1-left', cfg.h1.x    + '%');
  wrap.style.setProperty('--hair1-top',  cfg.h1.y    + '%');
  wrap.style.setProperty('--hair1-width',cfg.h1.w    + '%');

  wrap.style.setProperty('--hair2-left', cfg.h2.x    + '%');
  wrap.style.setProperty('--hair2-top',  cfg.h2.y    + '%');
  wrap.style.setProperty('--hair2-width',cfg.h2.w    + '%');
}

function ghostApplyAll(wrap, cfg){
  ghostApply(wrap, 'left',  cfg.left);
  ghostApply(wrap, 'right', cfg.right);
  ghostApply(wrap, 'h1',    cfg.h1);
  ghostApply(wrap, 'h2',    cfg.h2);
}

function ghostApply(wrap, key, v){
  switch(key){
    case 'left':
      wrap.style.setProperty('--eyeL-left',  v.x + '%');
      wrap.style.setProperty('--eyeL-top',   v.y + '%');
      wrap.style.setProperty('--eyeL-width', v.w + '%');
      break;
    case 'right':
      wrap.style.setProperty('--eyeR-left',  v.x + '%');
      wrap.style.setProperty('--eyeR-top',   v.y + '%');
      wrap.style.setProperty('--eyeR-width', v.w + '%');
      break;
    case 'h1':
      wrap.style.setProperty('--hair1-left',  v.x + '%');
      wrap.style.setProperty('--hair1-top',   v.y + '%');
      wrap.style.setProperty('--hair1-width', v.w + '%');
      break;
    case 'h2':
      wrap.style.setProperty('--hair2-left',  v.x + '%');
      wrap.style.setProperty('--hair2-top',   v.y + '%');
      wrap.style.setProperty('--hair2-width', v.w + '%');
      break;
  }
}

function cssText(cfg){
  return `
:root{}

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