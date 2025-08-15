// Systems dropdown, inline create input, and single action button
import { $, log, warn, error } from './config.js';
import { state, setCurrentSystem, setGraph, setEditorEnabled } from './state.js';
import { listSystems, createSystem, deleteSystem, loadSystem } from './api.js';
import { renderAll } from './canvas.js';

const CREATE_VALUE = '__create__';

export async function refreshSystems(selectId) {
  log('refreshSystems start', { selectId, guildId: state.guildId });

  const sel = $('#systemSelect');
  const hint = $('#sysHint');
  const nameInput = $('#newSystemName');
  const actionBtn = $('#actionBtn');

  // Load systems
  let systems = [];
  try {
    systems = await listSystems(state.guildId);
  } catch (e) {
    error('listSystems failed', e);
  }
  log('systems fetched', systems);

  // Build options
  sel.innerHTML = '';
  const optCreate = document.createElement('option');
  optCreate.value = CREATE_VALUE;
  optCreate.textContent = '＋ Create new system…';
  sel.appendChild(optCreate);

  for (const s of systems) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.title || s.id;
    sel.appendChild(opt);
  }

  if (selectId) sel.value = selectId;
  else sel.value = CREATE_VALUE;

  // Wire (idempotent)
  if (!sel._wired) {
    sel._wired = true;
    sel.addEventListener('change', onChange);
    actionBtn.addEventListener('click', onAction);
  }

  // Trigger the initial change
  sel.dispatchEvent(new Event('change'));

  async function onChange() {
    const val = sel.value;
    log('system change →', val);

    if (val === CREATE_VALUE) {
      // Create mode: show input, action is Create, disable editor
      setCurrentSystem('');
      nameInput.style.display = '';
      nameInput.value = '';
      nameInput.placeholder = 'New system name';
      hint.textContent = 'Enter a name and press Create.';
      actionBtn.textContent = 'Create';
      actionBtn.classList.remove('danger');
      actionBtn.disabled = false;
      setEditorEnabled(false);
      return;
    }

    // Existing system: hide input, action is Delete, enable editor
    setCurrentSystem(val);
    nameInput.style.display = 'none';
    nameInput.value = '';
    hint.textContent = '';
    actionBtn.textContent = 'Delete';
    actionBtn.classList.add('danger');
    actionBtn.disabled = false;
    setEditorEnabled(true);

    // Load graph
    try {
      const doc = await loadSystem(state.guildId, state.currentSystemId);
      setGraph(doc?.nodes || [], doc?.edges || []);
      renderAll();
      log('loaded system', state.currentSystemId, 'nodes=', (doc?.nodes||[]).length);
    } catch (e) {
      error('loadSystem failed', e);
    }
  }

  async function onAction() {
    const mode = (sel.value === CREATE_VALUE) ? 'create' : 'delete';
    log('actionBtn click mode=', mode);

    if (mode === 'create') {
      const title = nameInput.value.trim();
      if (!title) { nameInput.focus(); return; }
      try {
        const created = await createSystem(state.guildId, title);
        log('created system', created);
        await refreshSystems(created.id); // reselect as current
      } catch (e) {
        error('createSystem failed', e);
      }
      return;
    }

    // delete
    if (!state.currentSystemId) return;
    if (!confirm('Delete this system? This cannot be undone.')) return;
    try {
      await deleteSystem(state.guildId, state.currentSystemId);
      log('deleted system', state.currentSystemId);
      await refreshSystems(); // defaults to Create…
    } catch (e) {
      error('deleteSystem failed', e);
    }
  }
}
