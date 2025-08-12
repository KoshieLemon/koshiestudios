import { mountParallax }        from './parallax.js';
import { mountGlitchScheduler } from './glitchScheduler.js';
import { mountGlitchSlices }    from './glitchSlices.js';
import { mountDepthOfField }    from './depthOfField.js';
import { mountMessageSystem }   from './messages.js';

const scene   = document.getElementById('scene');
const slicesC = document.getElementById('slices');

mountParallax(scene);
mountGlitchScheduler(scene);
mountGlitchSlices(slicesC, scene);
mountDepthOfField(scene);
mountMessageSystem(scene);

/* ---------- Intro: BLACK → feathered eyes → radial bloom from eyes’ center ---------- */
(function mountIntroRevealEyesBloom(){
  const curtain = document.getElementById('introCurtain');
  const vsoft   = document.getElementById('vignetteSoft');
  const eyeL    = document.getElementById('kadieEyeLeft');
  const eyeR    = document.getElementById('kadieEyeRight');
  if (!curtain || !eyeL || !eyeR) return;

  const rcL = eyeL.getBoundingClientRect();
  const rcR = eyeR.getBoundingClientRect();
  const center = {
    x: (rcL.left + rcL.width/2 + rcR.left + rcR.width/2)/2,
    y: (rcL.top  + rcL.height/2+ rcR.top  + rcR.height/2)/2
  };

  function cloneEye(srcEl){
    const r = srcEl.getBoundingClientRect();
    const img = new Image();
    img.src = srcEl.currentSrc || srcEl.src;
    img.className = 'intro-eye';
    img.style.left   = (r.left + r.width/2) + 'px';
    img.style.top    = (r.top  + r.height/2)+ 'px';
    img.style.width  = r.width + 'px';
    return img;
  }
  const cloneL = cloneEye(eyeL), cloneR = cloneEye(eyeR);
  curtain.appendChild(cloneL); curtain.appendChild(cloneR);

  function setEyeBloomMask(radius, feather){
    const cx = center.x, cy = center.y;
    const g = `radial-gradient(circle at ${cx}px ${cy}px,
               rgba(0,0,0,0) 0 ${Math.max(0,radius - feather)}px,
               rgba(0,0,0,1) ${radius}px 100%)`;
    curtain.style.webkitMaskImage = g;
    curtain.style.maskImage = g;
  }

  const BLACK_HOLD = 600;
  const EYE_FADE   = 900;
  const EYE_HOLD   = 900;
  const BLOOM_DUR  = 1600;
  const FEATHER    = Math.max(180, Math.min(innerWidth, innerHeight) * 0.22);
  const MAX_R      = Math.hypot(innerWidth, innerHeight);
  const start = performance.now();

  curtain.style.opacity = '1';
  if (vsoft) vsoft.style.opacity = '0';
  setEyeBloomMask(0, FEATHER);

  const smooth = k => k*k*(3 - 2*k);

  function tick(now){
    const t = now - start;

    if (t < BLACK_HOLD) { requestAnimationFrame(tick); return; }

    if (t < BLACK_HOLD + EYE_FADE) {
      const k = smooth((t - BLACK_HOLD)/EYE_FADE);
      cloneL.style.opacity = k; cloneR.style.opacity = k;
      requestAnimationFrame(tick); return;
    }

    if (t < BLACK_HOLD + EYE_FADE + EYE_HOLD) {
      cloneL.style.opacity = '1'; cloneR.style.opacity = '1';
      requestAnimationFrame(tick); return;
    }

    const tb = (t - (BLACK_HOLD + EYE_FADE + EYE_HOLD)) / BLOOM_DUR;
    const k  = Math.min(1, tb);
    const e  = smooth(k);
    const radius = MAX_R * e;
    setEyeBloomMask(radius, FEATHER);

    if (vsoft) vsoft.style.opacity = String(0.35 * e);

    const eyeFade = Math.max(0, 1 - e*1.3);
    cloneL.style.opacity = String(eyeFade);
    cloneR.style.opacity = String(eyeFade);

    if (k < 1) requestAnimationFrame(tick);
    else curtain.remove();
  }
  requestAnimationFrame(tick);

  addEventListener('resize', () => {
    const rL = eyeL.getBoundingClientRect(), rR = eyeR.getBoundingClientRect();
    cloneL.style.left = (rL.left + rL.width/2) + 'px';
    cloneL.style.top  = (rL.top  + rL.height/2) + 'px';
    cloneL.style.width= rL.width + 'px';
    cloneR.style.left = (rR.left + rR.width/2) + 'px';
    cloneR.style.top  = (rR.top  + rR.height/2) + 'px';
    cloneR.style.width= rR.width + 'px';

    center.x = (rL.left + rL.width/2 + rR.left + rR.width/2)/2;
    center.y = (rL.top  + rL.height/2+ rR.top  + rR.height/2)/2;
  }, { passive:true });
})();
