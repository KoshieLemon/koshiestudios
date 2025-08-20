// Config + helpers

// Python service (Firestore systems CRUD)
export const PY_API_BASE = 'https://kadie-ai-py.up.railway.app';
export const SERVERS_PAGE = '/kadie-page/kadie-bot/bot-servers.html';

// Node service (elements). We read/store it from localStorage so you don't hardcode.
export const NODE_API_BASE = 'https://kadie-ai-node.up.railway.app';
export function getNodeApiBase() {
  return localStorage.getItem('kadie.node_api_base') || NODE_API_BASE;
}
export function setNodeApiBase(url) {
  localStorage.setItem('kadie.node_api_base', url);
}

// Tiny DOM helper
export function $(sel, root=document){ return root.querySelector(sel); }

// Logger guards
export function log(...a){ try{ if (window.KADIE_DEBUG) console.log('[Kadie]', ...a);}catch{} }
export function warn(...a){ try{ console.warn('[Kadie]', ...a);}catch{} }
export function error(...a){ try{ console.error('[Kadie]', ...a);}catch{} }

// URL params
export const params = Object.fromEntries(new URLSearchParams(location.search).entries());

// Sleep
export const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));

// Discord guild icon url helper
export function iconUrl(g){
  if (!g) return null;
  return g.icon
    ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128`
    : null;
}

// local/session JSON
export function getJSON(keys) {
  for (const k of keys) {
    try {
      const raw = sessionStorage.getItem(k) || localStorage.getItem(k);
      if (!raw) continue;
      const v = JSON.parse(raw);
      if (v && typeof v === 'object') return v;
    } catch (e) { error('getJSON parse error for', k, e); }
  }
  return null;
}
