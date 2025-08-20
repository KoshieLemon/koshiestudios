// drag from sidebar → drop on canvas; now always enabled
import { dom, view } from "./env.js";
import { state } from "../state.js";                 // kept for compatibility; not used to gate
import { addNodeFromElement } from "./index.js";

function worldFromClient(root, cx, cy){
  const r = root.getBoundingClientRect();
  const mx = cx - r.left;
  const my = cy - r.top;
  const s  = Number(view.scale) || 1;
  const tx = Number(view.tx) || 0;
  const ty = Number(view.ty) || 0;
  return { x: (mx - tx) / s, y: (my - ty) / s };
}

function hasKadiePayload(dt){
  return !!(dt && dt.types && (dt.types.includes("application/kadie-element") || dt.types.includes("kadie-element-id")));
}

function parsePayload(dt){
  if (!dt) return null;
  const json = dt.getData("application/kadie-element") || dt.getData("text/plain");
  if (json) { try { return JSON.parse(json); } catch(_){} }
  const id = dt.getData("kadie-element-id");
  if (id && Array.isArray(window.__elementsCache)) {
    return window.__elementsCache.find(e => String(e.id) === String(id)) || null;
  }
  return null;
}

// prevent double-handling when both vp and content receive capture-phase events
function guardOnce(ev){
  if (ev.__kadieDropHandled) return true;
  ev.__kadieDropHandled = true;
  return false;
}

function attachHandlers(target){
  if (!target || target.__kadieDndWired) return;
  target.__kadieDndWired = true;

  // Always allow graph use: no editorEnabled/currentSystemId gating
  target.addEventListener("dragover", (ev) => {
    if (!hasKadiePayload(ev.dataTransfer)) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = "copy";
  }, { capture: true });

  target.addEventListener("drop", (ev) => {
    if (!hasKadiePayload(ev.dataTransfer)) return;
    if (guardOnce(ev)) return;                 // ensure only one handler runs
    const meta = parsePayload(ev.dataTransfer);
    if (!meta) return;
    ev.preventDefault();
    const root = dom.vp || target;
    const { x, y } = worldFromClient(root, ev.clientX, ev.clientY);
    addNodeFromElement(meta, x, y);
  }, { capture: true });
}

export function wireDropAdd(root){
  attachHandlers(root || dom.vp);
  if (dom.content) attachHandlers(dom.content);

  // Keep DnD wired if content is rebuilt
  const rewire = () => { if (dom.content) attachHandlers(dom.content); };
  ["bp:graph-changed","bp:editor-enabled","bp:system-changed"].forEach(evt=>{
    window.removeEventListener(evt, rewire);
    window.addEventListener(evt, rewire);
  });
}
