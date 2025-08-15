// canvas/dnd.js — drag from sidebar → drop on canvas (world coords), dblclick spawn
import { dom, view } from "./env.js";
import { addNodeFromElement } from "./index.js";

function worldFromClient(root, cx, cy){
  const r = root.getBoundingClientRect();
  const mx = cx - r.left;
  const my = cy - r.top;
  return { x: (mx - view.tx) / view.scale, y: (my - view.ty) / view.scale };
}

export function wireDropAdd(root){
  // Drop target
  root.addEventListener("dragover", (ev)=> { ev.preventDefault(); ev.dataTransfer.dropEffect = "copy"; }, {capture:true});
  root.addEventListener("drop", (ev)=>{
    ev.preventDefault();
    let meta = null;
    // Prefer structured payload
    const json = ev.dataTransfer.getData("application/kadie-element") || ev.dataTransfer.getData("text/plain");
    if (json) { try { meta = JSON.parse(json); } catch(_){} }
    if (!meta){
      const id = ev.dataTransfer.getData("kadie-element-id");
      if (id && window.__elementsCache) meta = window.__elementsCache.find(e=> String(e.id)===String(id));
    }
    if (!meta) return;
    const { x, y } = worldFromClient(root, ev.clientX, ev.clientY);
    addNodeFromElement(meta, x, y);
  }, {capture:true});
}
