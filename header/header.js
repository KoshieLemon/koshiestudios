// header/header.js
// Ensures the brand button/link always works across all pages,
// while letting the portal cancel (on the index transition) still function.

(function () {
  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  function init() {
    // If your project already injects header markup elsewhere, we don't touch it.
    // We just make the brand reliably clickable and ensure header sits on top.
    const headerEl = document.querySelector('#site-header') || document.querySelector('header');

    // Raise header above any page overlays and make sure it's clickable
    if (headerEl) {
      const style = headerEl.style;
      if (!getComputedStyle(headerEl).position || getComputedStyle(headerEl).position === 'static') {
        style.position = 'fixed'; // stays consistent like your home page
        style.top = '0';
        style.left = '0';
        style.right = '0';
      }
      style.zIndex = '10000';
      style.pointerEvents = 'auto';
    }

    // Find all possible "brand home" elements
    const brandCandidates = Array.from(document.querySelectorAll(
      '.brand a, .brand button, header .brand a, #brand-home, [data-brand-home]'
    ));

    if (!brandCandidates.length) return;

    // Normalize each brand element to navigate home
    brandCandidates.forEach((el) => {
      // If it's an <a>, make sure it actually has an href
      if (el.tagName === 'A' && !el.getAttribute('href')) {
        el.setAttribute('href', '/');
      }

      // Kill any rogue handlers that might block navigation (capture-phase)
      el.addEventListener('click', (e) => {
        // If a portal is open (during index transition), let Router handle cancel.
        const portalOpen = !!document.querySelector('.portal');
        if (portalOpen) return; // do not hijack; Router's cancel should run

        // Hard navigate home on brand click
        e.preventDefault();
        e.stopImmediatePropagation();
        try {
          // Prefer assign to keep history behavior explicit
          window.location.assign('/');
        } catch {
          window.location.href = '/';
        }
      }, { capture: true });

      // Keyboard accessibility
      el.addEventListener('keydown', (e) => {
        const isButtony = el.tagName !== 'A';
        const activate = (e.key === 'Enter') || (isButtony && e.key === ' ');
        if (!activate) return;
        const portalOpen = !!document.querySelector('.portal');
        if (portalOpen) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        try { window.location.assign('/'); } catch { window.location.href = '/'; }
      }, { capture: true });

      // Treat non-anchors like links for a11y
      if (el.tagName !== 'A') {
        el.setAttribute('role', 'link');
        el.setAttribute('tabindex', '0');
        el.setAttribute('aria-label', 'Go to Koshie Studios home');
      }
    });

    // Defensive: ensure page overlays never block header clicks
    // (Your Kadie layers already use pointer-events:none, but just in case other pages change)
    const unblockHeader = () => {
      document.querySelectorAll('.portal, .parallax, .vignette, .msgs').forEach((lay) => {
        // Only adjust if they are above header and intercepting
        const z = Number(getComputedStyle(lay).zIndex || 0);
        if (z >= 10000) lay.style.zIndex = (10000 - 1).toString();
        if (getComputedStyle(lay).pointerEvents !== 'none') {
          lay.style.pointerEvents = 'none';
        }
      });
    };
    unblockHeader();
    // Run again later if other scripts add overlays
    setTimeout(unblockHeader, 0);
    setTimeout(unblockHeader, 500);
  }
})();
