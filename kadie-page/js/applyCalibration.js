// Apply saved eye/hair calibration on page load
const KEY = 'kadieEyeConfig';

(function(){
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySaved, { once:true });
  } else {
    applySaved();
  }
})();

function applySaved(){
  const wrap = document.getElementById('kadieWrap') || document.querySelector('.kadie-wrap');
  if (!wrap) return;
  let cfg = null;
  try { cfg = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
  if (!cfg) return;

  const set = (name, val) => wrap.style.setProperty(name, (typeof val === 'number' ? (val + '%') : val));
  if (cfg.left){  set('--eyeL-left',  cfg.left.x);  set('--eyeL-top',  cfg.left.y);  set('--eyeL-width',  cfg.left.w); }
  if (cfg.right){ set('--eyeR-left',  cfg.right.x); set('--eyeR-top',  cfg.right.y); set('--eyeR-width',  cfg.right.w); }
  if (cfg.h1){    set('--hair1-left', cfg.h1.x);    set('--hair1-top', cfg.h1.y);    set('--hair1-width', cfg.h1.w); }
  if (cfg.h2){    set('--hair2-left', cfg.h2.x);    set('--hair2-top', cfg.h2.y);    set('--hair2-width', cfg.h2.w); }
}
