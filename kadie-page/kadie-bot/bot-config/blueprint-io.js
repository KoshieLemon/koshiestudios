// blueprint-io.js — canvas graph <-> exact Firestore blueprint doc

import { normalizePortsFromElement } from './canvas/types.js';

/**
 * Build EXACT doc:
 * {
 *   title, systemId, entries: [nodeIds],
 *   nodes: { [id]: { elId } },
 *   data: { edges: [...] },
 *   ui: { nodes:{id:{x,y,w,h,z?}}, viewport:{tx,ty,scale} }
 * }
 */
export function toBlueprint(graph, title, systemId, ui){
  const g = graph || { nodes: [], edges: [] };
  const nodes = Array.isArray(g.nodes) ? g.nodes : [];
  const edges = Array.isArray(g.edges) ? g.edges : [];

  // entries = nodes with in-degree 0 for flow edges
  const inFlow = new Map();
  for (const e of edges){
    if ((e?.kind || 'data') !== 'flow') continue;
    const nid = e?.to?.node; if (!nid) continue;
    inFlow.set(nid, (inFlow.get(nid) || 0) + 1);
  }
  const entries = [];
  for (const n of nodes) if (!inFlow.has(n.id)) entries.push(n.id);

  // nodes map
  const nodesMap = {};
  for (const n of nodes){
    const elId = String(n.elId || n.element?.id || n.name || 'element');
    nodesMap[String(n.id)] = { elId };
  }

  // edges array (flow vs dataType)
  const bpEdges = edges.map(e => {
    const base = {
      from: { node: String(e?.from?.node || ''), port: (e?.from?.port | 0) },
      to:   { node: String(e?.to?.node   || ''), port: (e?.to?.port   | 0) }
    };
    if ((e?.kind || 'data') === 'flow') return { kind: 'flow', ...base };
    const dt = e?.dataType ? String(e.dataType) : (e?.type ? String(e.type) : undefined);
    return dt ? { dataType: dt, ...base } : { ...base };
  });

  // ui block
  let uiBlock;
  if (ui && typeof ui === 'object'){
    uiBlock = { nodes: ui.nodes || {}, viewport: ui.viewport || undefined };
  } else {
    const uiNodes = {};
    for (const n of nodes) uiNodes[n.id] = { x:n.x|0, y:n.y|0, w:n.w|0, h:n.h|0, z:n.z|0 };
    uiBlock = { nodes: uiNodes };
  }

  return {
    title: String(title || systemId || ''),
    systemId: String(systemId || title || ''),
    entries,
    nodes: nodesMap,        // object map EXACTLY as requested
    data: { edges: bpEdges },
    ui: uiBlock
  };
}

/**
 * Rehydrate exact doc to canvas graph.
 */
export function graphFromBlueprint(doc, elements){
  const out = { nodes: [], edges: [] };
  if (!doc || typeof doc !== 'object') return out;

  const catalog = Array.isArray(elements) ? elements : [];
  const nodeEntries = (doc.nodes && typeof doc.nodes === 'object') ? doc.nodes : {};
  const uiNodes = (doc.ui && doc.ui.nodes) ? doc.ui.nodes : (doc.data && doc.data.ui && doc.data.ui.nodes) ? doc.data.ui.nodes : {};

  for (const [id, meta] of Object.entries(nodeEntries)){
    const elId = String(meta?.elId || '');
    const elMeta = catalog.find(e => String(e.id || e.name || '') === elId) || { id: elId, name: elId, inputs:[], outputs:[] };
    const { inputs, outputs } = normalizePortsFromElement(elMeta);

    const ui = uiNodes[id] || {};
    out.nodes.push({
      id,
      name: String(elMeta.name || elId),
      elId,
      element: elMeta,
      inputs, outputs,
      x: Number.isFinite(ui.x) ? ui.x : 80,
      y: Number.isFinite(ui.y) ? ui.y : 60,
      w: Number.isFinite(ui.w) ? ui.w : 260,
      h: Number.isFinite(ui.h) ? ui.h : Math.max(100, 48 + Math.max(inputs.length, outputs.length) * 24)
    });
  }

  const edges = Array.isArray(doc?.data?.edges) ? doc.data.edges : [];
  out.edges = edges.map(e => ({
    id: `e_${Math.random().toString(36).slice(2,9)}`,
    from: { node: String(e?.from?.node||''), port: (e?.from?.port|0) },
    to:   { node: String(e?.to?.node||''),   port: (e?.to?.port|0) },
    kind: e.kind === 'flow' ? 'flow' : 'data',
    dataType: e.kind === 'flow' ? undefined : (e?.dataType ? String(e.dataType) : undefined)
  }));

  return out;
}
