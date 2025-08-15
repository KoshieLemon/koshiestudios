// Config + helpers

// Python service (Firestore systems CRUD)
export const PY_API_BASE = 'https://kadie-ai-py.up.railway.app';
export const SERVERS_PAGE = '/kadie-page/kadie-bot/bot-servers.html';

// Node service (elements). We read/store it from localStorage so you don't hardcode.
// Set it once in the console: localStorage.setItem('kadie.node_api_base','https://YOUR-NODE.up.railway.app')
export function getNodeApiBase() {
  return localStorage.getItem('kadie.node_api_base') || PY_API_BASE;
}
export function setNodeApiBase(url) {
  localStorage.setItem('kadie.node_api_base', url);
}

// Logger
export const log   = (...a) => { if (window.KADIE_DEBUG) console.log('[Blueprints]', ...a); };
export const warn  = (...a) => { if (window.KADIE_DEBUG) console.warn('[Blueprints]', ...a); };
export const error = (...a) => console.error('[Blueprints]', ...a);

// DOM helper
export const $ = (q) => document.querySelector(q);

// URL helpers
export const params = () => new URL(window.location.href).searchParams;

// Discord helpers
export const iconUrl = (g) => g?.icon
  ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128`
  : null;

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