// Message spawner v13 — staggered exit starts (organic), target 10–20 concurrent flows.
// - Starts ONE flow at a time on a jittered cadence so they ladder up naturally.
// - Keeps OVER band (above Kadie but avoiding her rect), sector balance, no same-spot spam.
// - Front/OVER weighted exit selection so visible cards are favored.

import { loadList, pick, buildMessage } from './data.js';
import { leftEye, rightEye } from './eyes.js';
import { layoutCharsAsLine } from './layout.js';
import { animateCharSnakeHybrid } from './flow.js';

export async function mountMessageSystem(scene){
  const kadieWrap = document.getElementById('kadieWrap');

  // Bands (under Kadie) + OVER (above Kadie, avoids the PNG)
  const LAYERS = [
    { key:'back',  msg: byId('messageLayerBack'),  line: byId('lineLayerBack'),  target: 42, weight: 1, blur: readBlur(byId('messageLayerBack'),  2.6), forbidKadie:false },
    { key:'mid',   msg: byId('messageLayerMid'),   line: byId('lineLayerMid'),   target: 56, weight: 2, blur: readBlur(byId('messageLayerMid'),   1.6), forbidKadie:false },
    { key:'front', msg: byId('messageLayerFront'), line: byId('lineLayerFront'), target: 70, weight: 3, blur: readBlur(byId('messageLayerFront'), 0.8), forbidKadie:false },
    { key:'over',  msg: byId('messageLayerOver'),  line: byId('lineLayerOver'),  target: 20, weight: 4, blur: readBlur(byId('messageLayerOver'),  0.4), forbidKadie:true  }
  ].filter(L => L.msg && L.line);

  // Data
  const names = await loadList('/kadie-page/data/names.txt');
  const lines = await loadList('/kadie-page/data/messages.txt');
  const fbNames = ['Kadie Tester','Katherine','Unbiased Katie','Lego Lily','Krowange Mod','Mysterious User'];
  const fbLines = ['We are so back.','Who pinged me?','I think it’s watching us.','placeholder text Placeholder text','Uploading… 99%… 99%… 99%…','hello from the void'];

  // Field
  const OVERSCAN=120, EDGE=24;
  const sRect = () => scene.getBoundingClientRect();
  const kRect = () => kadieWrap ? kadieWrap.getBoundingClientRect() : {left:0,top:0,width:0,height:0};
  function field(){
    const s=sRect(); return { left:s.left-OVERSCAN, right:s.right+OVERSCAN, top:s.top-OVERSCAN, bottom:s.bottom+OVERSCAN, stage:s };
  }
  function overForbid(){
    const k = kRect();
    const pad = Math.max(24, Math.min(k.width||0, k.height||0) * 0.10);
    return { x:(k.left||0)-pad, y:(k.top||0)-pad, w:(k.width||0)+pad*2, h:(k.height||0)+pad*2 };
  }
  const inRect = (x,y,r) => x>r.x && x<r.x+r.w && y>r.y && y<r.y+r.h;

  // Sector balance (around Kadie)
  const SECTORS=8, sectorCounts=new Array(SECTORS).fill(0);
  const kCenter = () => { const k=kRect(); return {cx:(k.left||0)+(k.width||0)/2, cy:(k.top||0)+(k.height||0)/2}; };
  const chooseSector=()=>{
    const min=Math.min(...sectorCounts); const c=[];
    for (let i=0;i<SECTORS;i++) if (sectorCounts[i]<=min+1) c.push(i);
    return c[(Math.random()*c.length)|0];
  };
  const inc = i => sectorCounts[i] = (sectorCounts[i]||0)+1;
  const dec = i => sectorCounts[i] = Math.max(0,(sectorCounts[i]||0)-1);

  // Avoid exact same coords (per layer)
  const CELL=64, cells=new Map(), order=new Map();
  for (const L of LAYERS){ cells.set(L.key,new Set()); order.set(L.key,[]); }
  const tok=(x,y)=>`${Math.round(x/CELL)},${Math.round(y/CELL)}`;
  function remember(key,x,y){ const set=cells.get(key), q=order.get(key), t=tok(x,y); if(!set.has(t)){ set.add(t); q.push(t); if(q.length>240){ set.delete(q.shift()); } } }
  const isRecent=(key,x,y)=>cells.get(key).has(tok(x,y));

  const approxW = () => Math.min(560, window.innerWidth * 0.44);
  const approxH = 118;

  function pickXYInSector(L, sectorIdx){
    const {left,right,top,bottom} = field();
    const forbid = L.forbidKadie ? overForbid() : null;
    const {cx,cy} = kCenter();
    const step = 2*Math.PI/SECTORS, a0=sectorIdx*step, a1=a0+step;
    for (let i=0;i<96;i++){
      const x = left + EDGE + Math.random()*Math.max(1,(right-left - EDGE*2 - approxW()));
      const y = top  + EDGE + Math.random()*Math.max(1,(bottom-top - EDGE*2 - approxH));
      const ang=(Math.atan2(y-cy,x-cx)+2*Math.PI)%(2*Math.PI);
      if (!(ang>=a0 && ang<a1)) continue;
      if (forbid && inRect(x,y,forbid)) continue;
      if (isRecent(L.key,x,y)) continue;
      remember(L.key,x,y); return {x,y};
    }
    return null;
  }
  function pickXYAny(L){
    const {left,right,top,bottom} = field();
    const forbid = L.forbidKadie ? overForbid() : null;
    for (let i=0;i<96;i++){
      const x = left + EDGE + Math.random()*Math.max(1,(right-left - EDGE*2 - approxW()));
      const y = top  + EDGE + Math.random()*Math.max(1,(bottom-top - EDGE*2 - approxH));
      if (forbid && inRect(x,y,forbid)) continue;
      if (isRecent(L.key,x,y)) continue;
      remember(L.key,x,y); return {x,y};
    }
    const x = right-EDGE-approxW(), y = bottom-EDGE-approxH(); remember(L.key,x,y); return {x,y};
  }

  // Populate the canvas with messages (kept roughly at target per band)
  function spawn(L){
    const name = pick(names, pick(fbNames,'Kadie User'));
    const text = pick(lines,  pick(fbLines,'hello from the void'));
    const { msg, dtext } = buildMessage(name, text);

    const sec = chooseSector();
    let pos = pickXYInSector(L, sec); if (!pos) pos = pickXYAny(L);
    const { x, y } = pos; inc(sec); msg.dataset.sector = String(sec);

    const s = field().stage;
    msg.style.left = Math.round(x - s.left) + 'px';
    msg.style.top  = Math.round(y - s.top ) + 'px';

    if (Number.isFinite(L.blur) && L.blur>0){
      const f = getComputedStyle(msg).filter || '';
      msg.style.filter = (f && f!=='none') ? `${f} blur(${L.blur}px)` : `blur(${L.blur}px)`;
    }

    L.msg.appendChild(msg);

    const readyAt = performance.now() + (DWELL_MIN + Math.random()*(DWELL_MAX-DWELL_MIN));
    exitQ.push({ msg, dtext, layer:L, readyAt });
  }

  function need(L){ return Math.max(0, L.target - (L.msg?.childElementCount||0)); }
  function topUp(){ for (const L of LAYERS) for(let i=0;i<need(L);i++) spawn(L); }

  // Weighted "ready" picker (front and over slightly favored)
  function pickReady(){
    const now=performance.now();
    const ready=exitQ.filter(e=>e.readyAt<=now && document.body.contains(e.msg));
    if (!ready.length) return null;
    const sum=ready.reduce((s,e)=>s+(e.layer.weight||1),0);
    let r=Math.random()*sum;
    for (let i=0;i<ready.length;i++){ r-=(ready[i].layer.weight||1); if (r<=0) return ready[i]; }
    return ready[ready.length-1];
  }

  // ---------- Exit flow control (staggered starts) ----------
  const DWELL_MIN=1700, DWELL_MAX=3200;

  // Desired concurrent flows (10–20), varies over time so it breathes
  const FLOW_MIN=10, FLOW_MAX=20;
  let targetConcurrent = FLOW_MIN + Math.floor(Math.random()*(FLOW_MAX-FLOW_MIN+1));
  setInterval(()=>{
    targetConcurrent = FLOW_MIN + Math.floor(Math.random()*(FLOW_MAX-FLOW_MIN+1));
  }, 2200);

  // Start cadence: one new flow every ~250–400ms (jittered), if ready & below target
  const START_BASE_MS = 260;
  const START_JITTER_MS = 160;

  let running=0;
  const exitQ=[];

  function scheduleNextStart(afterMs){
    setTimeout(starterTick, afterMs);
  }

  function starterTick(){
    const now = performance.now();

    // Start at most ONE flow per tick (staggered)
    if (running < targetConcurrent){
      const job = pickReady();
      if (job){
        const idx=exitQ.indexOf(job); if(idx>=0) exitQ.splice(idx,1);
        running++;
        runExit(job).finally(()=>{ running=Math.max(0,running-1); });
      }
    }

    // Re-schedule next check with jitter so it feels organic
    scheduleNextStart(START_BASE_MS + Math.random()*START_JITTER_MS);
  }

  async function runExit({msg,dtext,layer}){
    if (!document.body.contains(msg)) return;
    const eye = (Math.random()<0.5 ? leftEye() : rightEye());
    try{
      const layout = await layoutCharsAsLine(scene, layer.line, dtext);
      await animateCharSnakeHybrid(scene, msg, layer.line, layout, eye, {
        // Defaults live in flow.js; we keep them unless you want a global override
        spiral: { angularVelRPS: 0.58, radialPow: 1.85, endRadius: 10 }
      });
    }catch(_e){ /* ignore */ }
    finally{
      const si = parseInt(msg.dataset.sector||'-1',10);
      if (!Number.isNaN(si) && si>=0) sectorCounts[si] = Math.max(0, sectorCounts[si]-1);
      if (document.body.contains(msg)) msg.remove();
    }
  }

  // Start loops
  topUp();                                 // fill the canvas
  setInterval(topUp, 900);                 // keep populations topped up
  scheduleNextStart(400 + Math.random()*400); // begin staggered starter after a short prime

  // Helpers
  function byId(id){ return document.getElementById(id); }
  function readBlur(el, fb){
    if (!el) return fb;
    const ds = parseFloat(el.dataset?.blur || '');
    if (Number.isFinite(ds)) return ds;
    const m = (getComputedStyle(el).filter || '').match(/blur\(([\d.]+)px\)/);
    return m ? parseFloat(m[1]) : fb;
  }
}
