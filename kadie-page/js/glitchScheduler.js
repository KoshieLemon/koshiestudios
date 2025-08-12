export function mountGlitchScheduler(scene) {
  const ghostR = scene.querySelector('.ghost-r');
  const ghostC = scene.querySelector('.ghost-c');
  const soft = document.getElementById('warpSoftNoise');
  const heavy = document.getElementById('warpHeavyNoise');

  function setRGB(px){
    if (ghostR) ghostR.style.transform = `translate(${ px}px, ${-px}px)`;
    if (ghostC) ghostC.style.transform = `translate(${-px}px, ${ px}px)`;
  }

  function pulse(){
    scene.classList.add('glitching');
    soft && soft.setAttribute('baseFrequency', `${0.012 + Math.random()*0.01} ${0.02 + Math.random()*0.02}`);
    heavy && heavy.setAttribute('baseFrequency', `${0.03 + Math.random()*0.02} ${0.08 + Math.random()*0.04}`);

    setRGB(2 + Math.floor(Math.random()*3));
    setTimeout(()=>setRGB(0), 160 + Math.random()*140);
    setTimeout(()=>scene.classList.remove('glitching'), 200 + Math.random()*260);
  }

  function loop(){
    pulse();
    const next = 900 + Math.random()*2200;
    setTimeout(loop, next);
  }
  setTimeout(loop, 1200);
}
