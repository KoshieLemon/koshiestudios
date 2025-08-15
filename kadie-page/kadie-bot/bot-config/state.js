// state.js — central app state, dirty tracking, Undo/Redo history, and system switching

export const state = {
  graph: { nodes: [], edges: [] },
  dirty: false,
  history: [],
  future: [],
  guildId: null,
  guild: null,
  currentSystemId: null,
  editorEnabled: true,
};

const MAX_HISTORY = 100;

// ---------- Utilities ----------
function deepClone(o){ return JSON.parse(JSON.stringify(o)); }
function snapshot(){ return { graph: deepClone(state.graph) }; }
function inEditable(el){
  const n = el?.nodeName;
  return n === 'INPUT' || n === 'TEXTAREA' || el?.isContentEditable;
}

// ---------- Dirty / Events ----------
export function markDirty(reason = "change"){
  if (!state.dirty){
    state.dirty = true;
    document.body.classList.add("is-dirty");
  }
  window.dispatchEvent(new CustomEvent("bp:dirty", { detail:{ dirty:true, reason } }));
  queueHistoryPush();
}

export function clearDirty(){
  if (!state.dirty) return;
  state.dirty = false;
  document.body.classList.remove("is-dirty");
  window.dispatchEvent(new CustomEvent("bp:dirty", { detail:{ dirty:false } }));
}

// ---------- History (Undo/Redo) ----------
let histTimer = null;
function queueHistoryPush(){
  clearTimeout(histTimer);
  histTimer = setTimeout(pushHistory, 250);
}

function pushHistory(){
  histTimer = null;
  const last = state.history[state.history.length - 1];
  const cur = snapshot();
  if (JSON.stringify(last?.graph) === JSON.stringify(cur.graph)) return;
  state.history.push(cur);
  if (state.history.length > MAX_HISTORY) state.history.shift();
  state.future.length = 0;
}

// Compat export for modules that import { historyPush }.
export function historyPush(){
  pushHistory();
}

export function undo(){
  if (!state.history.length) return;
  const cur = snapshot();
  state.future.push(cur);
  const prev = state.history.pop();
  state.graph = deepClone(prev.graph);
  window.dispatchEvent(new Event("bp:graph-changed"));
}

export function redo(){
  if (!state.future.length) return;
  const cur = snapshot();
  state.history.push(cur);
  const next = state.future.pop();
  state.graph = deepClone(next.graph);
  window.dispatchEvent(new Event("bp:graph-changed"));
}

// Global keyboard shortcuts
window.addEventListener("keydown", (e)=>{
  if (inEditable(e.target)) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && k === "z"){
    e.preventDefault(); undo();
  } else if ((e.ctrlKey || e.metaKey) && (k === "y" || (e.shiftKey && k === "z"))){
    e.preventDefault(); redo();
  }
});

// ---------- System / Guild selection ----------
export function setEditorEnabled(v){
  state.editorEnabled = !!v;
  const el = document.getElementById('canvas');
  if (el) el.classList.toggle('disabled', !state.editorEnabled);
  window.dispatchEvent(new CustomEvent("bp:editor-enabled", { detail:{ enabled: state.editorEnabled }}));
}

export function setGuild(id, data){
  state.guildId = id ?? null;
  state.guild = data ?? null;
  window.dispatchEvent(new CustomEvent("bp:guild-changed", { detail:{ guildId: state.guildId, guild: state.guild }}));
}

export function setCurrentSystem(id, graph = null){
  state.currentSystemId = id ?? null;

  if (graph && typeof graph === "object"){
    state.graph = {
      nodes: Array.isArray(graph.nodes) ? deepClone(graph.nodes) : [],
      edges: Array.isArray(graph.edges) ? deepClone(graph.edges) : [],
    };
  } else {
    state.graph = { nodes: [], edges: [] };
  }

  state.history.length = 0;
  state.future.length = 0;
  clearDirty();

  window.dispatchEvent(new Event("bp:system-changed"));
  window.dispatchEvent(new Event("bp:graph-changed"));
}

export function setGraph(graph, { markAsDirty = false } = {}){
  state.graph = {
    nodes: Array.isArray(graph?.nodes) ? deepClone(graph.nodes) : [],
    edges: Array.isArray(graph?.edges) ? deepClone(graph.edges) : [],
  };
  state.history.length = 0;
  state.future.length = 0;
  if (markAsDirty) markDirty("setGraph"); else clearDirty();
  window.dispatchEvent(new Event("bp:graph-changed"));
}

export function getGraph(){ return deepClone(state.graph); }
export function serializeGraph(){ return deepClone(state.graph); }

// Convenience helpers
export function addNode(n){
  (state.graph.nodes ||= []).push(deepClone(n));
  markDirty("addNode");
  window.dispatchEvent(new Event("bp:graph-changed"));
}

export function addEdge(e){
  (state.graph.edges ||= []).push(deepClone(e));
  markDirty("addEdge");
  window.dispatchEvent(new Event("bp:graph-changed"));
}
