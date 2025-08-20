export function mountGlitchSlices(container, scene) {
  const MAX = 12, pool = [];
  for (let i=0;i<MAX;i++){
    const s = document.createElement('div');
    s.style.position='absolute'; s.style.left='0'; s.style.right=(Math.random()*30)+'%';
    s.style.height=(4+Math.random()*10)+'px'; s.style.top=(Math.random()*100)+'%';
    s.style.background='rgba(255,255,255,.06)'; s.style.mixBlendMode='overlay';
    s.style.opacity='0'; s.style.transform='translateY(-200%)';
    s.style.transition='opacity .08s linear';
    container.appendChild(s); pool.push(s);
  }

  function randomize(s){
    s.style.height=(4+Math.random()*10)+'px';
    s.style.right=(Math.random()*30)+'%';
    s.style.top=(Math.random()*100)+'%';
    s.style.transform='translateY(-200%)';
  }

  function animate(){
    const active = Math.floor(4 + Math.random()*8);
    for (let i=0;i<active;i++){
      const s = pool[i]; randomize(s); s.style.opacity='1';
      s.animate([{transform:'translateY(-200%)'},{transform:'translateY(200%)'}],
        {duration:260+Math.random()*240,easing:'steps(4,end)'}).onfinish=()=>{s.style.opacity='0'};
    }
  }

  const obs = new MutationObserver(()=>{ if(scene.classList.contains('glitching')) animate(); });
  obs.observe(scene,{attributes:true,attributeFilter:['class']});
}
