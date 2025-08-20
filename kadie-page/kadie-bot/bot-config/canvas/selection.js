import { dom, selection } from './env.js';

export function selectNode(id){
  selection.edgeId = '';
  selection.nodeId = id;
  dom.nodes.querySelectorAll('.node').forEach(n => n.classList.toggle('selected', n.dataset.id===id));
  dom.svg.querySelectorAll('.wire').forEach(w => w.classList.remove('selected'));
}
export function selectEdge(id){
  selection.nodeId = '';
  selection.edgeId = id;
  dom.nodes.querySelectorAll('.node').forEach(n => n.classList.remove('selected'));
  dom.svg.querySelectorAll('.wire').forEach(w => w.classList.toggle('selected', w.dataset.id===id));
}
export function clearSelection(){
  selection.nodeId = selection.edgeId = '';
  dom.nodes.querySelectorAll('.node').forEach(n => n.classList.remove('selected'));
  dom.svg.querySelectorAll('.wire').forEach(w => w.classList.remove('selected'));
}
