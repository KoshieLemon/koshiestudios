// API calls with dual-base support + verbose debug
import { PY_API_BASE, getNodeApiBase, setNodeApiBase, log, warn, error } from './config.js';

async function fetchJson(url, options) {
  const t0 = performance.now();
  log('fetch →', url, options || {});
  let res;
  try { res = await fetch(url, options); }
  catch (e) { error('network error', url, e); throw e; }
  log('response', res.status, res.statusText, 'for', url, `(+${(performance.now()-t0).toFixed(0)}ms)`);
  if (!res.ok) {
    const text = await res.text().catch(()=>'');
    error('bad status', res.status, 'url:', url, 'body:', text.slice(0, 500));
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const data = await res.json().catch(e => { error('json parse error', url, e); throw e; });
  log('json ←', url, data);
  return data;
}

// ---------- Systems (Python service) ----------
export const listSystems = (guildId) =>
  fetchJson(`${PY_API_BASE}/blueprints/${guildId}/systems`, { credentials: 'include' });

export const createSystem = (guildId, title) =>
  fetchJson(`${PY_API_BASE}/blueprints/${guildId}/systems`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ title })
  });

export const deleteSystem = async (guildId, systemId) => {
  const url = `${PY_API_BASE}/blueprints/${guildId}/systems/${systemId}`;
  log('delete →', url);
  const res = await fetch(url, { method:'DELETE' });
  log('delete status', res.status);
  if (res.status !== 200 && res.status !== 204 && res.status !== 404) {
    const body = await res.text().catch(()=> '');
    error('delete failed', res.status, body);
    throw new Error(`Delete failed: ${res.status}`);
  }
};

export const loadSystem = (guildId, systemId) =>
  fetchJson(`${PY_API_BASE}/blueprints/${guildId}/systems/${systemId}`);

export const saveSystem = (guildId, systemId, graph) => {
  const payload = {
    guildId, systemId,
    nodes: graph.nodes, edges: graph.edges,
    title: graph.title || systemId,
    updatedAt: Date.now(), version: 1
  };
  return fetchJson(`${PY_API_BASE}/blueprints/${guildId}/systems/${systemId}`, {
    method: 'PUT',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
};

// ---------- Elements (Node service) ----------
export const listElements = async () => {
  const nodeBase = getNodeApiBase();
  const elsUrl = `${nodeBase}/blueprints/elements`;
  const dbgUrl = `${nodeBase}/blueprints/debug`;

  log('elements endpoint:', elsUrl);

  let els = [];
  try {
    els = await fetchJson(elsUrl);
  } catch (e) {
    error('elements fetch failed from', nodeBase, e);
  }

  // Always try to fetch debug info and print it
  try {
    const dbg = await fetchJson(dbgUrl);
    log('elements debug', dbg);
  } catch (e) {
    warn('failed to fetch debug from', dbgUrl, e);
  }

  // If nothing returned, guide you once in console with a prompt to set the right Node base
  if ((!els || els.length === 0) && !sessionStorage.getItem('kadie.node_prompted')) {
    sessionStorage.setItem('kadie.node_prompted', '1');
    const maybe = window.prompt(
      `No elements returned from:\n\n${elsUrl}\n\n` +
      `If your Node bot is on a different Railway URL, enter it now (e.g. https://kadie-ai-node.up.railway.app).`
    );
    if (maybe && /^https?:\/\//i.test(maybe)) {
      setNodeApiBase(maybe.replace(/\/+$/,''));
      log('NODE API base set to', getNodeApiBase());
      // try again immediately
      return await listElements();
    }
  }

  return els;
};