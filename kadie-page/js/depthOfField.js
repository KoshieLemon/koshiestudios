export function mountDepthOfField(scene) {
  const curtain = scene.querySelector('#frontCurtain');
  const kadie = scene.querySelector('#kadie');
  let t = 0;
  function tick(){
    t += 0.016;
    const blur = 2.0 + Math.sin(t * 0.6) * 0.6;
    curtain.style.backdropFilter = `blur(${blur}px)`;
    curtain.style.webkitBackdropFilter = `blur(${blur}px)`;
    const scale = 1 + Math.sin(t * 0.35) * 0.006;
    kadie.style.transform = `scale(${scale})`;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
