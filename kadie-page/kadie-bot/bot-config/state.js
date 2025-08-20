// state.js — central app state, dirty tracking, history, and system switching
// This file preserves and exposes all previously used APIs by other modules.

import { log, warn, error } from './config.js';

export const state = {
  graph: { nodes: [], edges: [] },
  dirty: false,
  history: [],
  future: [],
  guildId: null,
  guild: null,
  currentSystemId: null,
  currentSystemTitle: null,
  editorEnabled: false,
};

const MAX_HISTORY = 100;

/* ---------------- History ---------------- */
export function historyPush(op, snapshot) {
  try {
    const snap = snapshot || deepClone(state.graph);
    state.history.push({ op: String(op||'op'), graph: snap });
    if (state.history.length > MAX_HISTORY) state.history.shift();
    state.future.length = 0;
  } catch (e) { warn('historyPush failed', e); }
}

export function historyUndo() {
  if (!state.history.length) return;
  const last = state.history.pop();
  state.future.push(deepClone(state.graph));
  state.graph = deepClone(last.graph);
  markDirty('undo');
  dispatch('bp:graph-changed');
}

export function historyRedo() {
  if (!state.future.length) return;
  const next = state.future.pop();
  state.history.push(deepClone(state.graph));
  state.graph = deepClone(next);
  markDirty('redo');
  dispatch('bp:graph-changed');
}

/* ---------------- Dirty ---------------- */
export function markDirty(reason='change'){ state.dirty = true; log('dirty →', reason); }
export function clearDirty(){ state.dirty = false; }

/* ---------------- Guild ---------------- */
export function setGuild(id, guild=null){
  state.guildId = id ? String(id) : null;
  state.guild = guild || null;
  dispatch('bp:guild-changed', { id: state.guildId });
}

/* ---------------- System selection ---------------- */
export function setCurrentSystem(id, title){
  state.currentSystemId = id || null;
  if (title !== undefined && title !== null && String(title).trim() !== '') {
    state.currentSystemTitle = String(title);
  } else if (id) {
    state.currentSystemTitle = String(id);
  } else {
    state.currentSystemTitle = null;
  }
  dispatch('bp:system-changed', { id, title: state.currentSystemTitle });
}

/* ---------------- Editor enable ---------------- */
export function setEditorEnabled(enabled){
  state.editorEnabled = !!enabled;
  dispatch('bp:editor-enabled', { enabled: state.editorEnabled });
}

/* ---------------- Graph ---------------- */
export function setGraph(g){
  state.graph = deepClone(g || {nodes:[],edges:[]});
  markDirty('set-graph');
  dispatch('bp:graph-changed');
}

export function serializeGraph(){
  // Normalize shape: { nodes:[], edges:[] }
  const g = state.graph || { nodes: [], edges: [] };
  return {
    nodes: Array.isArray(g.nodes) ? deepClone(g.nodes) : [],
    edges: Array.isArray(g.edges) ? deepClone(g.edges) : []
  };
}

export function addNode(n){
  (state.graph.nodes ||= []).push(deepClone(n));
  markDirty('addNode');
  dispatch('bp:graph-changed');
}

export function addEdge(e){
  (state.graph.edges ||= []).push(deepClone(e));
  markDirty('addEdge');
  dispatch('bp:graph-changed');
}

/* ---------------- Utils ---------------- */
export function deepClone(o){ return JSON.parse(JSON.stringify(o)); }
function dispatch(type, detail={}){ try{ window.dispatchEvent(new CustomEvent(type, { detail })); }catch{} }

// Auto-mark dirty when canvas reports changes
window.addEventListener('bp:graph-changed', () => {
  if (!state.dirty) markDirty('event');
});

// Hard reset to an empty graph without triggering rehydration races.
// Keeps existing APIs intact.
export function resetToBlankGraph(){
  try {
    state.graph = { nodes: [], edges: [] };
    state.history.length = 0;
    state.future.length = 0;
    state.dirty = false;
    // Single event so listeners update once
    dispatch('bp:graph-changed', { reason: 'blank-reset' });
  } catch (e) {
    // fall back to existing path if something throws
    try {
      setGraph({ nodes: [], edges: [] });
      clearDirty();
    } catch {}
  }
}