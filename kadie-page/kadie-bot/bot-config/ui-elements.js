// File: kadie-bot/bot-config/ui-elements.js
// Elements sidebar with collapsible sections, live node previews, and client-side search.
// Full file. Adds a search bar at the top of the sidebar without changing other systems.
// Updated: removes the "Elements" header from the sidebar wrap and adds a styled scrollable container.

import { $, log, warn, error } from './config.js';
import { listElements } from './api.js';
import { addNodeFromElement } from './canvas/index.js';
import { normalizePortsFromElement } from './canvas/types.js';

/* ---------- Section order (kept) ---------- */
const SECTIONS = [
  { key: 'flow',      title: 'Flow' },
  { key: 'general',   title: 'Discord Server General' },
  { key: 'membership',title: 'Discord Server Membership' },
  { key: 'text',      title: 'Discord Text Channel' },
  { key: 'voice',     title: 'Discord Voice Channel' },
  { key: 'events',    title: 'Discord Events' },
  { key: 'advanced',  title: 'Discord Advanced Server' },
];

/* ---------- Small DOM helper since config.js exports `$` ---------- */
function el(tag, props = {}, children = []) {
  const n = document.createElement(tag);
  Object.assign(n, props);
  if (props.style) Object.assign(n.style, props.style), delete n.style;
  for (const c of children) n.appendChild(c);
  return n;
}

/* ---------- Patches: styles, header removal, scroll container ---------- */
function ensureSidebarStyles(){
  if (document.getElementById('elementsSidebarStyles')) return;
  const css = `
#elementsSidebar, #sidebar { min-height: 0; overflow: hidden; }
#elementsSearchWrap { padding: 8px 8px 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.08); margin: 0 0 8px 0; }
#elementsSearch {
  width: 100%; box-sizing: border-box; background: rgba(26,30,44,.7);
  color: var(--text, #e9ecff); border: 1px solid var(--brd, rgba(255,255,255,0.12));
  border-radius: 10px; padding: 8px 10px; font: inherit; outline: none;
}
#elementsScroll {
  overflow-y: auto; overflow-x: hidden; max-height: calc(100vh - 120px);
  -webkit-overflow-scrolling: touch; scrollbar-width: thin;
  scrollbar-color: rgba(78,98,144,.7) transparent;
}
#elementsScroll::-webkit-scrollbar { width: 10px; }
#elementsScroll::-webkit-scrollbar-track { background: transparent; }
#elementsScroll::-webkit-scrollbar-thumb {
  background-color: rgba(28,42,77,.6); border-radius: 8px; border: 2px solid transparent; background-clip: content-box;
}
#elementsScroll::-webkit-scrollbar-thumb:hover { background-color: rgba(90,110,160,.75); }
`;
  const style = el('style', { id:'elementsSidebarStyles' });
  style.textContent = css;
  document.head.appendChild(style);
}

function removeSidebarHeader(){
  // Requirement: no "Elements" header inside the sidebar wrap.
  const sidebar = document.getElementById('elementsSidebar') || document.getElementById('sidebar');
  if (!sidebar) return;
  const directHeaders = Array.from(sidebar.children).filter(node =>
    node.matches && node.matches(':scope > h1, :scope > h2, :scope > h3, :scope > .elements-header')
  );
  directHeaders.forEach(h => h.remove());
}

function ensureScrollContainer(){
  const sidebar = document.getElementById('elementsSidebar') || document.getElementById('sidebar');
  if (!sidebar) return null;

  // Find or create search wrap (ensureSearchUI may also create it)
  let searchWrap = document.getElementById('elementsSearchWrap');
  // Create scroll container
  let scroll = document.getElementById('elementsScroll');
  if (!scroll) {
    scroll = el('div', { id:'elementsScroll' });
    if (searchWrap && searchWrap.parentElement === sidebar) {
      sidebar.insertBefore(scroll, searchWrap.nextSibling);
    } else {
      sidebar.appendChild(scroll);
    }
  }

  // Ensure #elements exists and is inside the scroll container
  let elementsRoot = document.getElementById('elements');
  if (!elementsRoot) {
    elementsRoot = el('div', { id:'elements' });
    scroll.appendChild(elementsRoot);
  } else if (elementsRoot.parentElement !== scroll) {
    scroll.appendChild(elementsRoot);
  }

  // Move any stray siblings (except searchWrap and scroll) into scroll to make them scrollable
  const toMove = [];
  for (const n of Array.from(sidebar.children)) {
    if (n === searchWrap || n === scroll) continue;
    toMove.push(n);
  }
  toMove.forEach(n => scroll.appendChild(n));

  // Prevent page scroll bleed at extremes
  sidebar.addEventListener('wheel', (e) => {
    const sc = scroll;
    if (!sc) return;
    const dy = e.deltaY || 0;
    const atTop = sc.scrollTop <= 0 && dy < 0;
    const atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1 && dy > 0;
    if (atTop || atBottom) e.preventDefault();
  }, { passive: false });

  return { sidebar, searchWrap, scroll, elementsRoot };
}

/* ---------- Classification ---------- */
export function classifyElement(elm) {
  const cat = String(elm.category || '').toLowerCase();
  const m = SECTIONS.find(s => s.key === cat);
  return m ? m.key : 'general';
}

/* ---------- Entry ---------- */
export async function loadElementsSidebar() {
  log('loadElementsSidebar: fetch elements');
  let elements = [];
  try {
    elements = await listElements();
    if (!Array.isArray(elements)) elements = [];
  } catch (e) {
    error('listElements failed', e);
    elements = [];
  }

  // Persist in a global cache for possible re-renders
  window.__elementsCache = elements;

  // Ensure styles, remove header, ensure scroll container
  ensureSidebarStyles();
  removeSidebarHeader();
  ensureScrollContainer();

  // Ensure search UI exists once
  ensureSearchUI();

  // Render sections
  renderElementsSidebar(elements);

  // Apply any existing filter
  const q = (/** @type {HTMLInputElement} */(document.getElementById('elementsSearch')))?.value || '';
  applyElementsFilter(q);
}

/* ---------- Search UI and filter ---------- */
function ensureSearchUI() {
  const sidebar = document.getElementById('elementsSidebar') || document.getElementById('sidebar');
  if (!sidebar) return;

  // Remove any "Elements" header that might be injected later
  removeSidebarHeader();

  // Already installed
  if (document.getElementById('elementsSearchWrap')) return;

  const wrap = el('div', {
    id: 'elementsSearchWrap',
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      alignItems: 'center',
      gap: '8px',
    }
  });

  const input = el('input', {
    id: 'elementsSearch',
    type: 'search',
    placeholder: 'Search elements…',
    autocapitalize: 'off',
    autocomplete: 'off',
    spellcheck: false,
  });

  const badge = el('div', { id: 'elementsSearchCount', textContent: '' });
  Object.assign(badge.style, {
    fontSize: '12px',
    color: 'var(--muted, rgba(233,236,255,0.72))',
    whiteSpace: 'nowrap',
  });

  // Insert search at the very top of the sidebar
  sidebar.prepend(wrap);
  wrap.appendChild(input);
  wrap.appendChild(badge);

  // Ensure scroll container exists after adding search
  ensureScrollContainer();

  // Events
  input.addEventListener('input', () => {
    const q = input.value || '';
    applyElementsFilter(q);
  });
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') {
      input.value = '';
      applyElementsFilter('');
    }
  });
}

function tokenize(q) {
  return String(q || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function applyElementsFilter(q) {
  const tokens = tokenize(q);
  const root = document.getElementById('elements');
  const badge = document.getElementById('elementsSearchCount');
  if (!root) return;

  let totalVisible = 0;
  const sections = Array.from(root.querySelectorAll('.acc-section'));

  const queryActive = tokens.length > 0;

  for (const sec of sections) {
    const body = sec.querySelector('.acc-body');
    if (!body) continue;

    const cards = Array.from(body.querySelectorAll('.elPreview'));
    let visibleInSection = 0;

    for (const card of cards) {
      const hay = (card.getAttribute('data-search') || card.textContent || '').toLowerCase();
      const isHit = tokens.every(t => hay.includes(t));
      card.style.display = (!queryActive || isHit) ? '' : 'none';
      if (!queryActive || isHit) visibleInSection++;
    }

    if (queryActive) {
      sec.style.display = visibleInSection ? '' : 'none';
      sec.setAttribute('data-open', visibleInSection ? 'true' : 'false');
      if (visibleInSection) body.style.maxHeight = 'none';
    } else {
      sec.style.display = '';
      body.style.maxHeight = '';
    }

    totalVisible += visibleInSection;
  }

  if (badge) {
    if (queryActive) {
      badge.textContent = totalVisible ? `${totalVisible} result${totalVisible===1?'':'s'}` : 'No results';
    } else {
      badge.textContent = '';
    }
  }
}

/* ---------- Render elements → sections ---------- */
function renderElementsSidebar(elements) {
  // Ensure scroll container and elements root exist
  const parts = ensureScrollContainer();
  const wrap = parts && parts.elementsRoot ? parts.elementsRoot : document.getElementById('elements');
  if (!wrap) return;

  // Clear and normalize wrapper
  wrap.innerHTML = '';
  Object.assign(wrap.style, {
    display: 'block',
    margin: wrap.style.margin || '0',
    padding: wrap.style.padding || '0',
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderRadius: '0',
    boxShadow: 'none',
  });

  // Bucketize
  const buckets = Object.fromEntries(SECTIONS.map(s => [s.key, []]));
  for (const el of elements) {
    const k = classifyElement(el);
    (buckets[k] || buckets.general).push(el);
  }
  for (const k of Object.keys(buckets)) {
    buckets[k].sort((a,b)=> String(a.name||a.id).localeCompare(String(b.name||b.id)));
  }

  // Append sections in order
  for (const { key, title } of SECTIONS) {
    wrap.appendChild(renderSection(title, buckets[key] || [], key));
  }

  log('elements sidebar rendered', { total: elements.length });

  // Notify others the sidebar rebuilt
  window.dispatchEvent(new CustomEvent('bp:elements-refreshed'));
}

/* ---------- Accordion section ---------- */
function renderSection(title, items, storageKey) {
  const sec = el('section', { className: 'acc-section' }, []);

  Object.assign(sec.style, {
    margin: '0',
    padding: '0',
    border: 'none',
    borderRadius: '0',
    background: 'transparent',
  });

  const header = el('button', {
    className: 'acc-header',
    innerHTML: `<span>${escapeHtml(title)}</span>`,
  });
  Object.assign(header.style, {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '8px 12px',
    margin: '0',
    background: 'transparent',
    border: '0',
    borderRadius: '0',
    textAlign: 'left',
    cursor: 'pointer',
    font: 'inherit',
    color: 'var(--text, #e9ecff)',
    boxShadow: 'none',
  });
  header.addEventListener('mouseenter', () => { header.style.background = 'rgba(255,255,255,0.035)'; });
  header.addEventListener('mouseleave', () => { header.style.background = 'transparent'; });

  const body = el('div', { className: 'acc-body' });
  Object.assign(body.style, {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '8px',
    padding: '8px 12px',
    margin: '0',
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderRadius: '0',
    boxShadow: 'none',
    overflow: 'hidden',
    transition: 'max-height 160ms ease',
  });

  // Toggle open/close with localStorage
  const lsKey = `kadie.acc.${storageKey}`;
  const initialOpen = localStorage.getItem(lsKey) !== 'false';
  sec.dataset.open = String(!!initialOpen);

  function setOpen(open) {
    sec.dataset.open = String(!!open);
    localStorage.setItem(lsKey, String(!!open));
    if (open) {
      body.style.maxHeight = 'none';
    } else {
      body.style.maxHeight = '0px';
    }
  }

  header.addEventListener('click', () => setOpen(sec.dataset.open !== 'true'));

  // Populate items
  if (!items || !items.length) {
    const empty = el('div', { className: 'acc-empty', textContent: 'No entries' });
    Object.assign(empty.style, {
      fontSize: '12px',
      color: 'var(--muted, rgba(233,236,255,0.72))',
      padding: '8px 12px',
      borderTop: '1px solid rgba(255,255,255,0.08)',
    });
    body.appendChild(empty);
  } else {
    for (const meta of items) body.appendChild(renderPreviewEntry(meta));
  }

  // Compose
  sec.appendChild(header);
  sec.appendChild(body);

  // Open state after mount
  requestAnimationFrame(() => setOpen(initialOpen));

  return sec;
}

/* ---------- Preview entry card (draggable) ---------- */
function renderPreviewEntry(elMeta) {
  const card = el('div', { className: 'elPreview' });
  card.setAttribute('draggable', 'true');
  card.title = elMeta.description || elMeta.id || '';

  Object.assign(card.style, {
    margin: '6px 0',
    padding: '0',
    borderRadius: '0',
    border: 'none',
    background: 'transparent',
    boxShadow: 'none',
  });

  // Build search haystack once and store in data-search
  const { inputs = [], outputs = [] } = normalizePortsFromElement(elMeta);
  const portTerms = []
    .concat(inputs.map(p => `${p.name||''} ${p.kind||''} ${p.type||''}`))
    .concat(outputs.map(p => `${p.name||''} ${p.kind||''} ${p.type||''}`))
    .join(' ');
  const hay = [
    elMeta.name, elMeta.id, elMeta.category,
    Array.isArray(elMeta.tags) ? elMeta.tags.join(' ') : '',
    portTerms
  ].filter(Boolean).join(' ').toLowerCase();
  card.setAttribute('data-search', hay);

  // Inner preview
  const preview = buildNodePreview(elMeta);
  const wrap = el('div', { className: 'previewWrap' });
  Object.assign(wrap.style, {
    margin: '0',
    padding: '0',
    border: '1px dashed rgba(255,255,255,.12)',
    borderRadius: '12px',
    overflow: 'hidden',
    background: 'rgba(255,255,255,0.01)',
    cursor: 'grab',
    userSelect: 'none',
  });
  wrap.appendChild(preview);
  card.appendChild(wrap);

  // Drag payload
  let dragging = false;
  card.addEventListener('dragstart', (e) => {
    dragging = true;
    try {
      e.dataTransfer.setData('application/kadie-element', JSON.stringify(elMeta));
      e.dataTransfer.setData('kadie-element-id', String(elMeta.id));
      e.dataTransfer.setData('text/plain', JSON.stringify(elMeta));
      e.dataTransfer.effectAllowed = 'copy';
    } catch {}
  });
  card.addEventListener('dragend', () => { dragging = false; });

  // Click → add at default position (canvas module chooses)
  card.addEventListener('click', () => { if (!dragging) addNodeFromElement(elMeta); });

  return card;
}

/* ---------- Build a compact node preview using canvas/types ---------- */
function buildNodePreview(elMeta) {
  const { inputs, outputs } = normalizePortsFromElement(elMeta);

  const node = el('div', { className: 'node previewNode' });
  node.style.left = '0px';
  node.style.top  = '0px';

  const title = el('div', { className: 'title' });
  title.innerHTML = `<span>${escapeHtml(elMeta.name || elMeta.id)}</span>`;
  node.appendChild(title);

  const ports = el('div', { className: 'ports' });

  const inCol  = el('div', { className: 'ioCol' });
  const outCol = el('div', { className: 'ioCol' });

  inputs.forEach(p => {
    const tClass = p.kind === 'data'
      ? (' t-' + String(p.type||'any').toLowerCase().replace(/[^a-z0-9]+/g,'-'))
      : ' t-exec';
    const port = el('div', { className: 'port in ' + (p.kind==='flow' ? 'pin-flow' : 'pin-data') + tClass });
    port.innerHTML = `<span class="portDot"></span><span>${escapeHtml(p.name || '')}${p.kind==='data' ? ` : ${escapeHtml(p.type||'any')}`:''}</span>`;
    inCol.appendChild(port);
  });

  outputs.forEach(p => {
    const tClass = p.kind === 'data'
      ? (' t-' + String(p.type||'any').toLowerCase().replace(/[^a-z0-9]+/g,'-'))
      : ' t-exec';
    const port = el('div', { className: 'port out ' + (p.kind==='flow' ? 'pin-flow' : 'pin-data') + tClass });
    port.innerHTML = `<span>${escapeHtml(p.name || '')}${p.kind==='data' ? ` : ${escapeHtml(p.type||'any')}`:''}</span><span class="portDot"></span>`;
    outCol.appendChild(port);
  });

  ports.appendChild(inCol);
  ports.appendChild(outCol);
  node.appendChild(ports);

  return node;
}

/* ---------- Utils ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* ---------- Re-apply layout after dynamic changes ---------- */
window.addEventListener('bp:elements-refreshed', () => {
  // Ensure header stays removed and scroll container persists after any external re-render
  removeSidebarHeader();
  ensureScrollContainer();
});
