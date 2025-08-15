// /kadie-page/js/addToDiscordPortal.js
// Kadie page bottom-center action portal. No OAuth here; it just routes to the servers page.
(() => {
  const SERVERS_PAGE = '/kadie-page/kadie-bot/bot-servers.html';
  const BUTTON_OFFSET_Y = -30;
  const MAX_Z = 2147483647;

  let root = document.getElementById('kadie-portal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'kadie-portal-root';
    document.body.appendChild(root);
  }
  Object.assign(root.style, { position:'fixed', inset:'0', zIndex:String(MAX_Z), pointerEvents:'none' });

  const STYLE_ID = 'kadie-portal-style';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #kadie-portal-btn{
        position:absolute; left:0; top:0; transform:translate(-50%,0);
        pointer-events:auto; appearance:none; border:none; border-radius:9999px;
        padding:12px 18px; font-weight:700; letter-spacing:.3px;
        display:inline-flex; align-items:center; gap:.5rem; cursor:pointer;
        background:rgba(20,24,35,0.72); color:#e9ecff;
        border:1px solid rgba(255,255,255,0.22);
        box-shadow:0 10px 26px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,0.06);
        backdrop-filter:blur(6px);
        text-transform:none; white-space:nowrap;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
        font-size:14px;
      }
      #kadie-portal-btn:hover{ filter:brightness(1.06) }
      #kadie-portal-btn:active{ transform:translate(-50%,0) scale(.99) }
      #kadie-portal-btn .ico{ width:18px; height:18px; fill:currentColor }
    `;
    document.head.appendChild(style);
  }

  let btn = document.getElementById('kadie-portal-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'kadie-portal-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Sign in to Discord');
    btn.innerHTML = `
      <svg class="ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 245 240" aria-hidden="true">
        <path d="M104.4 104.9c-5.7 0-10.2 5-10.2 11.1s4.6 11.1 10.2 11.1c5.7 0 10.2-5 10.2-11.1s-4.5-11.1-10.2-11.1zm36.2 0c-5.7 0-10.2 5-10.2 11.1s4.6 11.1 10.2 11.1c5.7 0 10.2-5 10.2-11.1s-4.5-11.1-10.2-11.1z"/>
        <path d="M189.5 20h-134C32.3 20 10 42.3 10 69.6v100.8C10 197.7 32.3 220 55.6 220h113.6l-5.3-18.5 12.7 11.8 12 11.1 21.2 19V69.6C209.6 42.3 197.3 20 189.5 20z"/>
      </svg>
      <span>Sign in to Discord</span>
    `;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = SERVERS_PAGE;
    });
    root.appendChild(btn);
  }

  function position() {
    const k = document.getElementById('kadie');
    const cx = window.innerWidth / 2;
    if (k) {
      const r = k.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        btn.style.left = (r.left + r.width / 2) + 'px';
        btn.style.top  = (r.bottom + BUTTON_OFFSET_Y) + 'px';
      } else {
        btn.style.left = cx + 'px';
        btn.style.top  = (window.innerHeight - 80) + 'px';
      }
    } else {
      btn.style.left = cx + 'px';
      btn.style.top  = (window.innerHeight - 80) + 'px';
    }
    btn.style.display = 'inline-flex';
    requestAnimationFrame(position);
  }
  requestAnimationFrame(position);
})();
