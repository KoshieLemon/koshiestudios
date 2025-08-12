// Mount Kadie hair and hook to calibrator CSS vars.
// Creates #kadieHair01 and #kadieHair02 inside #kadieWrap.
// Positions use var(--hairX-*) so the existing calibrator moves/resizes them.

(function () {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }

  function mount() {
    const wrap = document.getElementById('kadieWrap') || document.querySelector('.kadie-wrap');
    if (!wrap) { console.warn('[hairMount] No #kadieWrap found'); return; }

    // Avoid duplicates if hot-reloaded
    if (!document.getElementById('kadieHair01')) {
      wrap.appendChild(makeHairImg({
        id: 'kadieHair01',
        cls: 'kadie-hair hair-01 base',
        src: '/kadie-page/page-assets/kadie_hair_01.png',
        // Use CSS vars so the calibrator controls these
        leftVar: '--hair1-left',
        topVar: '--hair1-top',
        widthVar: '--hair1-width',
        leftFallback: '36%',
        topFallback: '54%',
        widthFallback: '36%',
        z: 8060
      }));
    }

    if (!document.getElementById('kadieHair02')) {
      wrap.appendChild(makeHairImg({
        id: 'kadieHair02',
        cls: 'kadie-hair hair-02 base',
        src: '/kadie-page/page-assets/kadie_hair_02.png',
        leftVar: '--hair2-left',
        topVar: '--hair2-top',
        widthVar: '--hair2-width',
        leftFallback: '64%',
        topFallback: '54%',
        widthFallback: '36%',
        z: 8060
      }));
    }

    console.info('[hairMount] Hair mounted and bound to calibrator vars.');
  }

  function makeHairImg(opts) {
    const img = document.createElement('img');
    img.id = opts.id;
    img.className = opts.cls;
    img.alt = '';
    img.decoding = 'async';
    img.loading = 'eager'; // we want it visible immediately
    img.src = opts.src;

    // Same overlay band as the eyes; no effects, just show it.
    const s = img.style;
    s.position = 'absolute';
    s.pointerEvents = 'none';
    s.zIndex = String(opts.z);
    s.transform = 'translate(-50%, -50%)';
    // Bind to calibrator-controlled CSS vars with sensible fallbacks
    s.left  = `var(${opts.leftVar}, ${opts.leftFallback})`;
    s.top   = `var(${opts.topVar}, ${opts.topFallback})`;
    s.width = `var(${opts.widthVar}, ${opts.widthFallback})`;

    return img;
  }
})();