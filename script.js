document.addEventListener('DOMContentLoaded', () => {
  const viewport = document.querySelector('.viewport');
  const camera   = document.querySelector('.camera');
  const wrapper  = document.querySelector('.grid-wrapper');
  const cell     = document.querySelector('.cell');
  const content  = document.getElementById('content');

  // NOTE: #logo-btn is created by header.js after it fetches header.html
  // script.js is deferred and loaded AFTER header.js in index.html, so it's available:
  const logoBtn  = document.getElementById('logo-btn');

  let active = false;

  // drag state
  let isDragging = false, startX = 0, startY = 0, ox = 0, oy = 0;

  viewport.addEventListener('mousedown', e => {
    if (active) return;
    isDragging = true;
    startX = e.clientX; startY = e.clientY;
    wrapper.style.setProperty('--drag-scale', '0.98');
    camera.style.setProperty('--bgscale', '0.98');
    viewport.classList.add('dragging');
    wrapper.style.cursor = 'grabbing';
    wrapper.style.transition = 'none';
  });

  document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    const nx = ox + dx, ny = oy + dy;
    wrapper.style.setProperty('--ox', `${nx}px`);
    wrapper.style.setProperty('--oy', `${ny}px`);
    camera.style.setProperty('--bgx', `${nx}px`);
    camera.style.setProperty('--bgy', `${ny}px`);
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    wrapper.style.transition = '';
    wrapper.style.setProperty('--ox', '0px');
    wrapper.style.setProperty('--oy', '0px');
    wrapper.style.setProperty('--drag-scale', '1');
    camera.style.setProperty('--bgx', '0px');
    camera.style.setProperty('--bgy', '0px');
    camera.style.setProperty('--bgscale', '1');
    ox = 0; oy = 0;
    viewport.classList.remove('dragging');
    wrapper.style.cursor = 'grab';
  });

  cell.addEventListener('click', () => {
    if (active) return;
    active = true;

    wrapper.style.setProperty('--drag-scale', '1');
    camera.style.setProperty('--bgscale', '1');

    const rect = cell.getBoundingClientRect();
    const cam  = camera.getBoundingClientRect();
    const cx   = rect.left - cam.left + rect.width/2;
    const cy   = rect.top  - cam.top  + rect.height/2;
    const s    = Math.max(window.innerWidth / rect.width, window.innerHeight / rect.height);

    camera.style.setProperty('--origin-x', `${cx}px`);
    camera.style.setProperty('--origin-y', `${cy}px`);
    camera.style.setProperty('--s', `${s}`);
    camera.classList.add('zoom');

    camera.addEventListener('transitionend', function onEnd(ev){
      if (ev.propertyName !== 'opacity') return;
      content.innerHTML = `<iframe src="krowange-page/krowange.html" class="page-frame"></iframe>`;
      content.classList.add('visible');
      camera.removeEventListener('transitionend', onEnd);
    });

    history.pushState({ page: 'krowange' }, '', '#krowange');
  });

  logoBtn?.addEventListener('click', () => {
    if (!active) return;
    content.classList.remove('visible');
    camera.classList.remove('zoom');
    active = false;
    history.pushState({}, '', 'index.html');
  });

  window.addEventListener('popstate', e => {
    if (e.state?.page === 'krowange' && !active) cell.click();
    else if (!e.state && active) logoBtn?.click();
  });
});
