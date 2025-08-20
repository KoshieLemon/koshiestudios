export async function loadList(url){
  try{
    const r = await fetch(url, {cache:'no-store'});
    if(!r.ok) throw 0;
    return (await r.text()).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  }catch{ return []; }
}
export const pick = (arr, fb) => arr.length ? arr[(Math.random()*arr.length)|0] : fb;

const initials = n => n.split(/\s+/).map(p=>p[0]?.toUpperCase()||'').slice(0,2).join('');
const randomColor = (h=Math.floor(Math.random()*360)) => `hsl(${h} 70% 55%)`;

function makePFP(name){
  const el=document.createElement('div'); el.className='pfp';
  el.style.background=`radial-gradient(circle at 30% 30%, #fff3, #0000 40%), ${randomColor()}`;
  const ini=document.createElement('span'); ini.className='ini'; ini.textContent=initials(name);
  el.appendChild(ini); return el;
}

export function buildMessage(name, text){
  const msg=document.createElement('div'); msg.className='dmsg';
  const row=document.createElement('div'); row.className='drow';
  const pfp=makePFP(name);
  const content=document.createElement('div'); content.className='dcontent';
  const head=document.createElement('div'); head.className='dhead';
  const dname=document.createElement('span'); dname.className='dname'; dname.textContent=name;
  const dtime=document.createElement('span'); dtime.className='dtime';
  const now=new Date(); dtime.textContent=`Today at ${now.getHours()%12||12}:${String(now.getMinutes()).padStart(2,'0')} ${now.getHours()<12?'AM':'PM'}`;
  head.appendChild(dname); head.appendChild(dtime);
  const dtext=document.createElement('div'); dtext.className='dtext'; dtext.textContent=text;
  content.appendChild(head); content.appendChild(dtext);
  row.appendChild(pfp); row.appendChild(content); msg.appendChild(row);
  return {msg,dtext};
}