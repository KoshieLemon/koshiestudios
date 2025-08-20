// Systems UI — the BAR IS the dropdown, animated.
// Selecting "Create new…" collapses the menu and turns the BAR text into an input.
// Press Enter or click away: commit name -> embed back to text.
// Duplicate names error on commit. Pencil to edit name anytime. Trash on saved systems (top bar only).
// Create/rename persists only on Save. Switching loads graph immediately.

import { $, log, error } from './config.js';
import { state, setCurrentSystem, setGraph, setEditorEnabled, clearDirty, resetToBlankGraph } from './state.js';
import { listSystems, deleteSystem, loadSystem, listElements } from './api.js';
import { renderAll, setViewport } from './canvas/index.js';
import { graphFromBlueprint } from './blueprint-io.js';

let _built = false;
let _open  = false;
let _editNameMode = false;
let _lastSystems = [];
let _outsideClickBound = false;

const host      = () => document.querySelector('#systemsBar') || document.querySelector('.systemsBar') || $('.systemsBar');
const root      = () => document.querySelector('#sysDropdown');
const moreBox   = () => document.querySelector('#sysMore');
const disp      = () => document.querySelector('#sysDisplay');
const topInput  = () => document.querySelector('#sysTopInput');
const editBtn   = () => document.querySelector('#sysEditBtn');
const delBtn    = () => document.querySelector('#sysDelBtn');
const errBox    = () => document.querySelector('#sysNameErr');

// ---- shell ----
function ensureShell(){
  if (_built && root()) { bindOutsideClose(); return; }
  const h = host(); if (!h) return;
  if (root()) { _built = true; bindOutsideClose(); return; }

  const r = document.createElement('div');
  r.id = 'sysDropdown';
  r.style.position = 'relative';
  r.style.width = '100%';
  r.style.background = '#0f1320';
  r.style.border = '1px solid var(--brd)';
  r.style.borderRadius = '12px';
  r.style.boxShadow = '0 4px 18px rgba(0,0,0,.35)';
  r.style.overflow = 'hidden';

  const stack = document.createElement('div');
  stack.style.display = 'flex';
  stack.style.flexDirection = 'column';

  const top = document.createElement('div');
  top.id = 'sysRowSelected';
  top.style.display = 'grid';
  top.style.gridTemplateColumns = '1fr auto auto auto';
  top.style.alignItems = 'center';
  top.style.gap = '6px';
  top.style.padding = '12px 14px';
  top.style.userSelect = 'none';

  const label = document.createElement('div');
  label.id = 'sysDisplay';
  label.textContent = 'Select a system...';
  label.style.whiteSpace = 'nowrap';
  label.style.overflow = 'hidden';
  label.style.textOverflow = 'ellipsis';
  label.style.fontWeight = '600';
  label.style.cursor = 'pointer';
  label.addEventListener('click', () => toggleOpen());

  const input = document.createElement('input');
  input.id = 'sysTopInput';
  input.type = 'text';
  input.placeholder = 'New system name…';
  input.style.display = 'none';
  input.style.width = '100%';
  input.style.padding = '9px 10px';
  input.style.borderRadius = '8px';
  input.style.border = '1px solid var(--brd)';
  input.style.background = '#131827';
  input.style.color = 'var(--text)';
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitName(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  });
  input.addEventListener('blur', () => commitName());

  const labelWrap = document.createElement('div');
  labelWrap.style.display = 'block';
  labelWrap.appendChild(label);
  labelWrap.appendChild(input);

  const edit = document.createElement('button');
  edit.id = 'sysEditBtn';
  edit.textContent = '✎';
  edit.title = 'Edit name';
  styleIcon(edit);
  edit.addEventListener('click', (e) => { e.stopPropagation(); enterEdit(); });

  const del = document.createElement('button');
  del.id = 'sysDelBtn';
  del.textContent = '🗑';
  del.title = 'Delete system';
  styleIcon(del);
  del.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!state.currentSystemId) return;
    if (!confirm(`Delete “${state.currentSystemTitle || state.currentSystemId}”?`)) return;
    try {
      await deleteSystem(state.guildId, state.currentSystemId);
      _editNameMode = false;
      setCurrentSystem(null, null);
      setGraph({ nodes: [], edges: [] });
      clearDirty();
      setEditorEnabled(false);
      renderAll();
      await refreshSystems();
    } catch (e2) { error('deleteSystem failed', e2); }
  });

  const caret = document.createElement('button');
  caret.id = 'sysCaret';
  caret.textContent = '▾';
  caret.title = 'Open menu';
  styleIcon(caret);
  caret.addEventListener('click', (e) => { e.stopPropagation(); toggleOpen(); });

  top.appendChild(labelWrap);
  top.appendChild(edit);
  top.appendChild(del);
  top.appendChild(caret);

  const more = document.createElement('div');
  more.id = 'sysMore';
  more.style.height = '0px';
  more.style.overflow = 'hidden';
  more.style.transition = 'height 160ms ease';
  more.style.willChange = 'height';

  const err = document.createElement('div');
  err.id = 'sysNameErr';
  err.style.display = 'none';
  err.style.color = 'var(--danger)';
  err.style.fontSize = '12px';
  err.style.padding = '0 14px 10px';
  err.textContent = '';

  stack.appendChild(top); stack.appendChild(more); stack.appendChild(err);
  r.appendChild(stack); h.appendChild(r);

  bindOutsideClose();
  _built = true;
}

function bindOutsideClose(){
  if (_outsideClickBound) return;
  window.addEventListener('click', (ev) => {
    if (!root()) return;
    if (root().contains(ev.target)) return;
    toggleOpen(false);
  });
  window.addEventListener('resize', recalcOpenHeight);
  _outsideClickBound = true;
}

function styleIcon(btn){
  btn.type = 'button';
  btn.style.border = '1px solid var(--brd)';
  btn.style.background = 'rgba(26,30,44,.7)';
  btn.style.color = 'var(--text)';
  btn.style.padding = '6px 8px';
  btn.style.borderRadius = '8px';
  btn.style.cursor = 'pointer';
  btn.style.width = '34px';
  btn.style.height = '34px';
  btn.style.display = 'grid';
  btn.style.placeItems = 'center';
  btn.onmouseenter = () => btn.style.borderColor = 'rgba(142,161,255,0.35)';
  btn.onmouseleave = () => btn.style.borderColor = 'var(--brd)';
}

function toggleOpen(v){
  const box = moreBox(); if (!box) return;
  _open = (v === undefined ? !_open : !!v);
  box.style.height = _open ? (box.scrollHeight + 'px') : '0px';
}
function recalcOpenHeight(){
  const box = moreBox();
  if (!box || !_open) return;
  box.style.height = 'auto';
  const h = box.scrollHeight;
  box.style.height = h + 'px';
}

function enterEdit(){
  _editNameMode = true;
  const inp = topInput(), d = disp();
  if (!inp || !d) return;
  d.style.display = 'none';
  inp.style.display = 'block';
  inp.value = (state.currentSystemTitle || '').trim();
  setTimeout(() => inp.focus(), 0);
}
function cancelEdit(){
  _editNameMode = false;
  hideError();
  const inp = topInput(), d = disp();
  if (!inp || !d) return;
  inp.style.display = 'none';
  d.style.display = 'block';
  renderDisplayText();
}
function commitName(){
  const inp = topInput(); if (!inp) return;
  const name = (inp.value || '').trim();
  if (!name) { showError('Name cannot be empty'); setTimeout(() => inp.focus(), 0); return; }
  const exists = _lastSystems.some(it =>
    ('' + (it.title || it.name || '')).trim().toLowerCase() === name.toLowerCase() &&
    (state.currentSystemId ? (it.id !== state.currentSystemId && it.systemId !== state.currentSystemId) : true)
  );
  if (exists) { showError('A system with this name already exists.'); inp.style.borderColor = 'rgba(255,120,120,0.7)'; setTimeout(() => inp.focus(), 0); return; }
  inp.style.borderColor = 'var(--brd)'; hideError();
  setCurrentSystem(state.currentSystemId || null, name);
  _editNameMode = false;
  const d = disp(); if (d) d.style.display = 'block';
  inp.style.display = 'none';
  renderDisplayText();
}

function showError(msg){
  const e = errBox(); if (!e) return;
  e.textContent = msg || 'Invalid name';
  e.style.display = 'block';
}
function hideError(){
  const e = errBox(); if (!e) return;
  e.style.display = 'none'; e.textContent = '';
}

function renderDisplayText(){
  const d = disp(); if (!d) return;
  if (state.currentSystemId) d.textContent = state.currentSystemTitle || state.currentSystemId;
  else if ((state.currentSystemTitle || '').trim()) d.textContent = state.currentSystemTitle.trim();
  else d.textContent = 'Select a system...';
  if (editBtn()) editBtn().style.display = 'grid';
  if (delBtn())  delBtn().style.display  = state.currentSystemId ? 'grid' : 'none';
}

function row(label, {onClick} = {}){
  const el = document.createElement('div');
  el.textContent = label;
  el.style.padding = '10px 14px';
  el.style.cursor = onClick ? 'pointer' : 'default';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.gap = '8px';
  el.style.background = '#0f1320';
  el.style.borderTop = '1px solid rgba(255,255,255,.06)';
  if (onClick) {
    el.onmouseenter = () => el.style.background = 'rgba(255,255,255,.05)';
    el.onmouseleave = () => el.style.background = '#0f1320';
    el.onclick = (e) => { e.stopPropagation(); onClick(); };
  }
  return el;
}
function divider(){
  const hr = document.createElement('div');
  hr.style.height = '1px';
  hr.style.margin = '6px 0';
  hr.style.background = 'rgba(255,255,255,.08)';
  return hr;
}

function buildList(){
  const box = moreBox(); if (!box) return;
  box.innerHTML = '';

  const createLi = row('➕ Create new...', {
    onClick: () => {
      setCurrentSystem(null, '');
      setEditorEnabled(true);
      resetToBlankGraph();
      renderAll();
      toggleOpen(false);
      requestAnimationFrame(() => enterEdit());
    }
  });

  box.appendChild(createLi);
  box.appendChild(divider());

  for (const it of _lastSystems) {
    const id = it.id || it.systemId || it.name || '';
    const title = it.title || it.name || id;
    const li = row(title, {
      onClick: async () => {
        try {
          const [doc, elements] = await Promise.all([
            loadSystem(state.guildId, id),
            listElements()
          ]);
          const sysName = doc.title || doc.name || title || id;
          const graph = graphFromBlueprint(doc, elements);

          setCurrentSystem(doc.id || id, sysName);
          setGraph(graph);
          clearDirty();
          setEditorEnabled(true);
          renderAll();

          const vp = (doc?.ui?.viewport) || (doc?.data?.ui?.viewport) || null;
          if (vp) setViewport(vp);

          renderDisplayText();
          toggleOpen(false);
        } catch (e) { error('loadSystem failed', e); }
      }
    });
    box.appendChild(li);
  }

  recalcOpenHeight();
}

// ---- public ----
export async function refreshSystems(){
  ensureShell();
  try { _lastSystems = await listSystems(state.guildId); } catch { _lastSystems = []; }
  if (_editNameMode) enterEdit(); else cancelEdit();
  renderDisplayText();
  buildList();
  window.removeEventListener('bp:system-created', _onSystemSavedOrCreated);
  window.addEventListener('bp:system-created', _onSystemSavedOrCreated);
}

async function _onSystemSavedOrCreated(){
  try {
    _lastSystems = await listSystems(state.guildId);
    _editNameMode = false;
    cancelEdit();
    renderDisplayText();
    buildList();
    toggleOpen(false);
  } catch (e) { error('post-save refresh failed', e); }
}
