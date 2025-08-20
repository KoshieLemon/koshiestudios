// Unsaved bar: Save / Revert. Triggers on moves/connects/deletes/duplicates.

import { $, log, error } from './config.js';
import { state, serializeGraph, clearDirty, setGraph, setCurrentSystem } from './state.js';
import { saveSystem, loadSystem, listElements } from './api.js';
import { renderAll, setViewport, snapshotUI } from './canvas/index.js';
import { toBlueprint, graphFromBlueprint } from './blueprint-io.js';

let _uiShadow = null;
let _watchTimer = null;

export function wireUnsavedBar() {
  const bar =
    $('#unsavedBar') || document.querySelector('.unsaved-bar') || document.getElementById('unsaved');
  const btnSave =
    $('#unsavedSave') || document.getElementById('unsaved-save') || bar?.querySelector('.btn-save');
  const btnRevert =
    $('#unsavedRevert') || document.getElementById('unsaved-revert') || bar?.querySelector('.btn-revert');

  const visible = () => !!(state.editorEnabled && state.dirty && (state.currentSystemId || state.currentSystemTitle));
  const update = () => { if (bar) bar.style.display = visible() ? 'grid' : 'none'; };

  update();
  window.addEventListener('bp:dirty-changed', update);
  window.addEventListener('bp:editor-changed', update);
  window.addEventListener('bp:system-changed', () => { resetShadow(); update(); });
  window.addEventListener('bp:graph-changed', () => { tickShadow(); update(); });
  window.addEventListener('bp:viewport-changed', () => { tickShadow(); update(); });
  window.addEventListener('bp:system-created', update);

  startDirtyWatch(update);

  if (btnSave) btnSave.onclick = async () => {
    if (!state.guildId) { error('Save: missing guildId'); return; }
    if (!state.currentSystemId && !state.currentSystemTitle) { error('Save: need a title to create'); return; }

    try {
      const graph = serializeGraph();
      const ui = snapshotUI();
      const title = (state.currentSystemTitle || '').trim() || 'Untitled';
      const systemId = state.currentSystemId || title;

      const exact = toBlueprint(graph, title, systemId, ui);
      // carry raw exec for Python step
      exact.execGraph = { nodes: graph.nodes || [], edges: graph.edges || [] };

      const res = await saveSystem(state.guildId, state.currentSystemId, title, exact);

      if (!state.currentSystemId && res && res.id) {
        setCurrentSystem(res.id, res.title || title);
        const ev = new CustomEvent('bp:system-created', { detail: { id: res.id, title: res.title || title } });
        window.dispatchEvent(ev);
      }

      clearDirty();
      resetShadow();
      update();
      log('Saved exact blueprint', res);
    } catch (e) {
      error('Save failed', e);
      alert('Save failed. See console.');
    }
  };

  if (btnRevert) btnRevert.onclick = async () => {
    if (!state.guildId || !state.currentSystemId) return;
    try {
      const [doc, elements] = await Promise.all([
        loadSystem(state.guildId, state.currentSystemId),
        listElements()
      ]);
      const graph = graphFromBlueprint(doc, elements);
      setGraph(graph);
      renderAll();
      const vp = (doc?.ui?.viewport) || null;
      if (vp) setViewport(vp);

      clearDirty();
      resetShadow();
      update();
      log('Reverted to saved state');
    } catch (e) {
      error('Revert failed', e);
      alert('Revert failed. See console.');
    }
  };
}

/* ---- Dirty watcher ---- */
function resetShadow(){
  try { _uiShadow = JSON.stringify(snapshotUI()); } catch { _uiShadow = null; }
}
function tickShadow(){
  try {
    const now = JSON.stringify(snapshotUI());
    if (_uiShadow !== null && now !== _uiShadow) {
      state.dirty = true;
      window.dispatchEvent(new Event('bp:dirty-changed'));
    }
    _uiShadow = now;
  } catch {}
}
function startDirtyWatch(onToggle){
  resetShadow();
  if (_watchTimer) clearInterval(_watchTimer);
  _watchTimer = setInterval(() => {
    if (!state.editorEnabled) return;
    tickShadow();
    if (onToggle) onToggle();
  }, 300);
}
