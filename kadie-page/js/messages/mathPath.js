import { clamp } from './utils.js';

export function cubicPoint(p0,p1,p2,p3,t){
  const u=1-t, tt=t*t, uu=u*u, uuu=uu*u, ttt=tt*t;
  return {
    x: uuu*p0.x + 3*uu*t*p1.x + 3*u*tt*p2.x + ttt*p3.x,
    y: uuu*p0.y + 3*uu*t*p1.y + 3*u*tt*p2.y + ttt*p3.y
  };
}

export function buildSampledPath(sx,sy,tx,ty){
  const dx=tx-sx, dy=ty-sy;
  const c1={x:sx-dy*0.35, y:sy+dx*0.35};
  const mx=sx+dx*0.55, my=sy+dy*0.55;
  const c2={x:mx+dy*0.45, y:my-dx*0.45};
  const pre={x:tx+28, y:ty};
  const lead={p0:{x:sx,y:sy},p1:c1,p2:c2,p3:pre};
  const r0=Math.max(16, Math.min(42, Math.hypot(pre.x-tx,pre.y-ty)));
  const turns=2.2 + Math.random()*0.6;

  const pts=[]; const push=(x,y)=>pts.push({x,y});
  const SEG_LEAD=140, SEG_SPIRAL=280;

  for(let i=0;i<=SEG_LEAD;i++){
    const t=i/SEG_LEAD; const p=cubicPoint(lead.p0,lead.p1,lead.p2,lead.p3,t); push(p.x,p.y);
  }
  for(let i=0;i<=SEG_SPIRAL;i++){
    const t=i/SEG_SPIRAL; const ang=t*(Math.PI*2*turns); const rd=Math.pow(1-t,1.12); const r=r0*rd;
    push(tx+Math.cos(ang)*r, ty+Math.sin(ang)*r);
  }

  const cum=[0], angs=[0];
  for(let i=1;i<pts.length;i++){
    const dx=pts[i].x-pts[i-1].x, dy=pts[i].y-pts[i-1].y;
    cum[i]=cum[i-1]+Math.hypot(dx,dy);
    angs[i]=Math.atan2(dy,dx);
  }
  const total = cum[cum.length-1];

  function pointAtDist(d){
    d=clamp(d,0,total);
    let lo=0,hi=cum.length-1;
    while(lo<hi){ const mid=(lo+hi)>>1; if(cum[mid]<d) lo=mid+1; else hi=mid; }
    const i=lo;
    if(i<=0) return {x:pts[0].x,y:pts[0].y,ang:angs[0]};
    const d0=cum[i-1], d1=cum[i], t=(d-d0)/(d1-d0||1);
    return { x:pts[i-1].x+(pts[i].x-pts[i-1].x)*t, y:pts[i-1].y+(pts[i].y-pts[i-1].y)*t, ang:angs[i] };
  }
  return { total, pointAtDist };
}