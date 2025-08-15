// Elements sidebar — flat, full-width collapsible lines + live node previews (no extra item title)
import { $, log, error } from './config.js';
import { listElements } from './api.js';
import { addNodeFromElement } from './canvas/index.js';
import { normalizePortsFromElement } from './canvas/types.js';

// Section order and display names
const SECTIONS = [
  { key: 'control',  title: 'Control Structures' },
  { key: 'server',   title: 'General Server' },
  { key: 'member',   title: 'Discord Membership' },
  { key: 'text',     title: 'Text Channel' },
  { key: 'voice',    title: 'Voice Channel' },
  { key: 'events',   title: 'Discord Events' },
  { key: 'advanced', title: 'Advanced Server' },
];

// Classify an element into one of the sections above
function classifyElement(el) {
  const id = String(el.id || '').toLowerCase();
  const cat = String(el.category || '').toLowerCase();

  if (cat === 'logic' || id === 'if' || id.startsWith('logic.') || el.name?.toLowerCase().includes('if')) {
    return 'control';
  }

  if (id.startsWith('discord.')) {
    if (/(kick|ban|unban|addrole|removerole|timeout|mute|unmute|member)/.test(id)) return 'member';
    if (/(message|send|post|embed|thread|reaction|pin|unpin|purge|delete)/.test(id)) return 'text';
    if (/(voice|vc|join|leave|move|deafen|undeafen)/.test(id)) return 'voice';
    if (id.startsWith('discord.event.') || cat.includes('event')) return 'events';
    if (/(permission|webhook|integration|audit|emoji|sticker|auto(?:mod)?|schedule|invite)/.test(id)) return 'advanced';
    return 'server';
  }

  if (/(server|guild)/.test(id) || cat.includes('server')) return 'server';
  return 'server';
}

export async function loadElementsSidebar() {
  log('loadElementsSidebar: fetching elements…');
  let elements = [];
  try {
    elements = await listElements();
  } catch (e) {
    error('listElements failed', e);
  }

  // Remove "Elements" header; keep sidebar flat
  try {
    const sidebar = $('#sidebar');
    const hdr = sidebar && sidebar.querySelector(':scope > h3');
    if (hdr) hdr.remove();
    if (sidebar) {
      sidebar.style.padding = '0';
      sidebar.style.gap = '0';
    }
  } catch {}

  const wrap = $('#elements');
  wrap.innerHTML = '';

  // Flat container
  Object.assign(wrap.style, {
    display: 'block',
    margin: '0',
    padding: '0',
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderRadius: '0',
    boxShadow: 'none',
  });

  // Cache for DnD id lookup
  window.__elementsCache = elements || [];

  // Bucketize and sort
  const buckets = Object.fromEntries(SECTIONS.map(s => [s.key, []]));
  for (const el of elements) {
    const k = classifyElement(el);
    (buckets[k] || buckets.server).push(el);
  }
  for (const k of Object.keys(buckets)) {
    buckets[k].sort((a,b)=> String(a.name||a.id).localeCompare(String(b.name||b.id)));
  }

  // Render in configured order
  for (const { key, title } of SECTIONS) {
    wrap.appendChild(renderSection(title, buckets[key] || [], key));
  }
}

/* ---------- Rendering (FLAT) ---------- */

function renderSection(title, items, storageKey) {
  const sec = document.createElement('div');
  sec.className = 'acc-section';

  Object.assign(sec.style, {
    margin: '0',
    padding: '0',
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderRadius: '0',
    boxShadow: 'none',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  });

  // restore open/closed from localStorage (default open)
  const lsKey = `kadie.acc.${storageKey}`;
  const open = localStorage.getItem(lsKey) !== 'false';
  sec.dataset.open = String(!!open);

  const header = document.createElement('button');
  header.className = 'acc-header';
  header.innerHTML = `<span>${escapeHtml(title)}</span><span class="chev">▸</span>`;

  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    width: '100%',
    padding: '10px 12px',
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

  const body = document.createElement('div');
  body.className = 'acc-body';

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

  const __setOpen = (openState) => {
    sec.dataset.open = String(!!openState);
    if (openState) {
      body.style.display = 'grid';
      body.style.maxHeight = 'none';
      const h = body.scrollHeight;
      body.style.maxHeight = h + 'px';
    } else {
      body.style.maxHeight = '0px';
    }
  };

  header.addEventListener('click', () => {
    const now = sec.dataset.open !== 'false';
    const next = !now;
    __setOpen(next);
    localStorage.setItem(lsKey, String(next));
  });

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'acc-empty';
    empty.textContent = 'No items in this section.';
    empty.style.opacity = '0.7';
    empty.style.padding = '2px 0';
    body.appendChild(empty);
  } else {
    for (const elMeta of items) {
      body.appendChild(renderPreviewEntry(elMeta));
    }
  }

  sec.appendChild(header);
  sec.appendChild(body);

  requestAnimationFrame(() => {
    const openInit = sec.dataset.open !== 'false';
    __setOpen(openInit);
  });

  return sec;
}

function renderPreviewEntry(elMeta) {
  // Flat preview entry showing ONLY the node preview (no separate title)
  const card = document.createElement('div');
  card.className = 'elPreview';
  card.setAttribute('draggable', 'true');
  card.title = elMeta.description || elMeta.id;

  Object.assign(card.style, {
    margin: '0',
    padding: '0',          // no extra space for a removed title
    borderRadius: '0',
    border: 'none',
    background: 'transparent',
    boxShadow: 'none',
  });

  // Node preview (already contains its own title inside the preview)
  const preview = buildNodePreview(elMeta);
  const wrap = document.createElement('div');
  wrap.className = 'previewWrap';
  wrap.style.padding = '6px 6px'; // minimal breathing room around the preview
  wrap.appendChild(preview);
  card.appendChild(wrap);

  // Drag payloads expected by canvas/dnd.js
  card.addEventListener('dragstart', (e) => {
    try {
      e.dataTransfer.setData('application/kadie-element', JSON.stringify(elMeta));
      e.dataTransfer.setData('kadie-element-id', String(elMeta.id));
      e.dataTransfer.effectAllowed = 'copy';
    } catch {}
  });

  // Click to add at canvas center
  card.addEventListener('click', () => {
    addNodeFromElement(elMeta);
  });

  return card;
}

function buildNodePreview(elMeta) {
  const { inputs, outputs } = normalizePortsFromElement(elMeta);

  const el = document.createElement('div');
  el.className = 'node previewNode';
  el.style.left = '0px';
  el.style.top  = '0px';

  const title = document.createElement('div');
  title.className = 'title';
  title.innerHTML = `<span>${escapeHtml(elMeta.name || elMeta.id)}</span>`;
  el.appendChild(title);

  const ports = document.createElement('div');
  ports.className = 'ports';

  const inCol  = document.createElement('div'); inCol.className  = 'ioCol';
  const outCol = document.createElement('div'); outCol.className = 'ioCol';

  inputs.forEach(p=>{
    const port = document.createElement('div');
    port.className = 'port in ' + (p.kind==='flow' ? 'pin-flow' : 'pin-data');
    port.innerHTML = `<span class="portDot"></span><span>${escapeHtml(p.name || '')}${p.kind==='data' ? ` : ${escapeHtml(p.type||'any')}`:''}</span>`;
    inCol.appendChild(port);
  });

  outputs.foreach ? null : null; // guard for older engines (not needed in modern)
  outputs.forEach(p=>{
    const port = document.createElement('div');
    port.className = 'port out ' + (p.kind==='flow' ? 'pin-flow' : 'pin-data');
    port.innerHTML = `<span>${escapeHtml(p.name || '')}${p.kind==='data' ? ` : ${escapeHtml(p.type||'any')}`:''}</span><span class="portDot"></span>`;
    outCol.appendChild(port);
  });

  ports.appendChild(inCol);
  ports.appendChild(outCol);
  el.appendChild(ports);

  return el;
}

/* ---------- Utils ---------- */
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}