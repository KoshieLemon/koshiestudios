// Inject header.html into #site-header on every page
(async () => {
  const mountId = 'site-header';
  let host = document.getElementById(mountId);
  if (!host) {
    host = document.createElement('div');
    host.id = mountId;
    document.body.prepend(host);
  }

  try {
    const res = await fetch('header.html', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load header.html');
    host.innerHTML = await res.text();

    // Highlight active link
    const path = location.pathname.replace(/\/+$/, '').split('/').slice(-2).join('/');
    host.querySelectorAll('.site-nav a').forEach(a => {
      const href = a.getAttribute('href').replace(/\/+$/, '');
      if (location.pathname.endsWith(href) || href === 'index.html' && /(^|\/)index\.html$/.test(location.pathname)) {
        a.classList.add('active');
      }
    });

    window.dispatchEvent(new Event('header:ready'));
  } catch (err) {
    console.error('[header] ', err);
  }
})();
