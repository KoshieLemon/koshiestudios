// Unsaved changes bar wiring
import { $, log, error } from './config.js';
import { state, resetDirty, showUnsavedBar, hideUnsavedBar } from './state.js';
import { saveSystem, loadSystem } from './api.js';
import { renderAll } from './canvas.js';

export function wireUnsavedBar() {
  const bar = $('#unsavedBar');
  const btnSave = $('#unsavedSave');
  const btnRevert = $('#unsavedRevert');

  btnSave.addEventListener('click', onSave);
  btnRevert.addEventListener('click', onRevert);

  log('unsaved bar wired');
}

async function onSave() {
  if (!state.currentSystemId) return;
  try {
    await saveSystem(state.guildId, state.currentSystemId, state.graph);
    resetDirty();
    log('saved system', state.currentSystemId);
  } catch (e) {
    error('save failed', e);
  }
}

async function onRevert() {
  if (!state.currentSystemId) return;
  try {
    const doc = await loadSystem(state.guildId, state.currentSystemId);
    // Replace in-place for re-render
    state.graph.nodes = (doc?.nodes) || [];
    state.graph.edges = (doc?.edges) || [];
    renderAll();
    resetDirty();
    log('reverted system to last saved', state.currentSystemId);
  } catch (e) {
    error('revert failed', e);
  }
}
