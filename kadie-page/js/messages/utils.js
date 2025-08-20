export const clamp = (v,min,max)=> v<min?min : v>max?max : v;
export function ease(t){ return t<.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }
export function parseBlurPx(el){
  const f = getComputedStyle(el).filter || '';
  const m = f.match(/blur\(([\d.]+)px\)/);
  return m ? parseFloat(m[1]) : 0;
}