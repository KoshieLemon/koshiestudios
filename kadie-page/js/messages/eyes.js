export const leftEye  = () => document.getElementById('kadieEyeLeft');
export const rightEye = () => document.getElementById('kadieEyeRight');
export function eyeCenter(el){
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width/2, y: r.top + r.height/2 };
}

