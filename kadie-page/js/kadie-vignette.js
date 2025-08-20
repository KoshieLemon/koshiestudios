// kadie-vignette.js
// Adds a soft but dark vignette to the whole page, without touching your layout.
// Edges are dark enough that content never visually touches the screen sides.

(() => {
  const STYLE_ID = "kadie-vignette-style";
  const OVERLAY_ID = "kadie-vignette-overlay";

  const CSS = `
:root{
  /* Tweak these if you want a stronger/weaker edge fade */
  --kadie-vignette-start: 55%;         /* where the fade begins (transparent) */
  --kadie-vignette-mid: 72%;           /* mid falloff */
  --kadie-vignette-opacity-mid: 0.82;  /* darkness at mid */
  --kadie-vignette-opacity-edge: 0.92; /* darkness at edge */
}

/* Fullscreen vignette overlay */
#${OVERLAY_ID}{
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2147483000; /* high, but below any debug HUD you might add */
  /* Big, soft oval so corners and sides fade nicely */
  background:
    radial-gradient(120% 100% at 50% 50%,
      rgba(0,0,0,0) var(--kadie-vignette-start),
      rgba(0,0,0,var(--kadie-vignette-opacity-mid)) var(--kadie-vignette-mid),
      rgba(0,0,0,var(--kadie-vignette-opacity-edge)) 100%);
  /* Multiply keeps whites from going gray and deepens blacks behind the overlay */
  mix-blend-mode: multiply;
}

/* Small screens: slightly stronger gutter feel */
@media (max-width: 640px){
  :root{
    --kadie-vignette-start: 50%;
    --kadie-vignette-mid: 70%;
    --kadie-vignette-opacity-mid: 0.88;
    --kadie-vignette-opacity-edge: 0.96;
  }
}
`;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function ensureOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;
    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    document.body.appendChild(overlay);
  }

  function mount() {
    ensureStyle();
    ensureOverlay();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
