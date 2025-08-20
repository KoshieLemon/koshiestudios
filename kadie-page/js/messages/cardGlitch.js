// /kadie-page/js/messages/cardGlitch.js
// Adds live blue warp-glitch to .dmsg cards with tiny CPU cost.

(function(){
  const noiseSoft  = document.getElementById('cwNoise');
  const noiseHeavy = document.getElementById('cwNoiseHeavy');
  if (!noiseSoft || !noiseHeavy) return; // SVG not present yet

  // Animate the turbulence a tiny bit for living, wobbly cards
  let t = Math.random()*1000;
  function tick(){
    t += 0.016;
    // gently modulate baseFrequency & seed
    const bfX = 0.004 + Math.abs(Math.sin(t*0.37))*0.004;  // 0.004..0.008
    const bfY = 0.015 + Math.abs(Math.cos(t*0.23))*0.008;  // 0.015..0.023
    noiseSoft.setAttribute('baseFrequency', `${bfX.toFixed(4)} ${bfY.toFixed(4)}`);
    if ((t*60|0) % 9 === 0) noiseSoft.setAttribute('seed', (Math.random()*1000|0).toString());
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // Burst scheduler: randomly pick visible cards and give them a heavier warp for ~120ms
  function burstGlitchOnOne(){
    const cards = Array.from(document.querySelectorAll('.dmsg'));
    if (!cards.length) return;
    const el = cards[(Math.random()*cards.length)|0];
    el.classList.add('glitch-now');
    setTimeout(()=> el.classList.remove('glitch-now'), 120 + (Math.random()*120|0));
  }
  setInterval(()=>{
    // 40% chance each second to do 1–3 microbursts
    if (Math.random() < 0.40){
      const bursts = 1 + (Math.random()*2|0);
      for (let i=0;i<bursts;i++) setTimeout(burstGlitchOnOne, i*60);
      // jiggle heavy noise a bit so bursts look different
      noiseHeavy.setAttribute('seed', (Math.random()*999|0).toString());
      noiseHeavy.setAttribute('baseFrequency', `${(0.018+Math.random()*0.01).toFixed(3)} ${(0.05+Math.random()*0.02).toFixed(3)}`);
    }
  }, 1000);
})();