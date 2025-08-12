// header/header.js
// Injects the shared header markup (inlined) and ensures it stays clickable above overlays.
// Side-effect module only; safe to include from any page.

(function () {
  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  const HEADER_HTML = `
<div class="site-header">
  <div class="header-backdrop"></div>
  <a id="logo-btn" class="brand" href="/">
    <img id="logo-img" class="brand-logo" src="/site-assets/koshiestudios_white_x1000.png" alt="Koshie Studios" />
    <span class="tagline">Koshie Studios</span>
  </a>
</div>
<style>
  #site-header { position: relative; z-index: 10001; }
  .site-header {
    position: fixed; top: 0; left: 0; width: 100%; height: 82px;
    display: flex; align-items: center; gap: 20px; padding: 0 24px;
    pointer-events: auto;
  }
  .header-backdrop {
    position: fixed; left: 0; top: 0; width: 100%; height: 18vh;
    background: linear-gradient(
      to top,
      rgba(0,0,0,0) 0%,
      rgba(15,17,16,0.65) 45%,
      #0f1110 100%
    );
    z-index: -1; pointer-events: none;
  }
  .brand { display: inline-flex; align-items: center; gap: 14px; color: #fff; text-decoration: none; }
  .brand-logo { width: 160px; height: auto; display: block; }
  .tagline { font-size: 14px; opacity: .9; white-space: nowrap; }
</style>
`;

  function ensureHost() {
    let host = document.querySelector('#site-header');
    if (!host) {
      host = document.createElement('div');
      host.id = 'site-header';
      document.body.prepend(host);
    }
    // Force on top
    host.style.position = host.style.position || 'relative';
    host.style.zIndex = host.style.zIndex || '10001';
    host.style.pointerEvents = host.style.pointerEvents || 'auto';
    return host;
  }

  function wireBrand(host) {
    const brand = host.querySelector('#logo-btn') || host.querySelector('.brand');
    if (!brand) return;
    brand.setAttribute('href', '/');
    brand.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.assign('/');
    }, { passive: false });
  }

  function keepHeaderClickable() {
    const layers = document.querySelectorAll('.portal, .parallax, .vignette, .msgs, .overlay, .content-overlay');
    layers.forEach((lay) => {
      const cs = getComputedStyle(lay);
      const z = Number(cs.zIndex || 0);
      if (z >= 10001) lay.style.zIndex = '10000';
      if ((cs.position === 'fixed' || cs.position === 'absolute') && cs.top === '0px') {
        lay.style.pointerEvents = 'none';
      }
    });
  }

  onReady(() => {
    const host = ensureHost();
    host.innerHTML = HEADER_HTML;

    // Re-apply styles if needed
    host.querySelectorAll('style').forEach((styleEl) => {
      const clone = styleEl.cloneNode(true);
      styleEl.replaceWith(clone);
    });

    wireBrand(host);
    keepHeaderClickable();
    setTimeout(keepHeaderClickable, 0);
    setTimeout(keepHeaderClickable, 500);
    console.log('[header] injected');
  });
})();
