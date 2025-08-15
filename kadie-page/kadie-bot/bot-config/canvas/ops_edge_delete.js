import { state, markDirty } from '../state.js';
import { dom } from './env.js';
import { cssEscape } from './utils.js';

export function deleteEdge(id){
  state.graph.edges = (state.graph.edges||[]).filter(e => e.id!==id);
  dom.svg.querySelectorAll('[data-id="'+cssEscape(id)+'"]').forEach(el => el.remove());
  markDirty();
}
