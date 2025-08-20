// api.js — Elements (Node service) + Systems (Python service)
// Saves exact blueprints (title/systemId/entries/nodes map/data.edges/ui) under
// Firestore: guilds/{guildId}/blueprints/{systemId}. Falls back to localStorage if Firebase missing.
// Python API is always updated with exec-only graph.

import { PY_API_BASE, getNodeApiBase, log, warn, error } from './config.js';

/* ========== HTTP utils ========== */
async function fetchJson(url, options) {
  const t0 = performance.now();
  const res = await fetch(url, options || {});
  if (!res.ok) {
    const body = await res.text().catch(()=> '');
    error('HTTP', res.status, url, body.slice(0,300));
    throw new Error(`HTTP ${res.status} ${url}`);
  }
  const data = await res.json().catch(()=> ({}));
  log('json ←', url, `+${(performance.now()-t0).toFixed(0)}ms`);
  return data;
}
function nodeBase(){ return getNodeApiBase(); }

/* ========== Exact store adapters ========== */
function makeLocalStore(){
  const KIDX = (g)=>`kadie:bp:index:${g}`;
  const KDOC = (g,s)=>`kadie:bp:${g}:${s}`;
  const read = (k)=>{ try{ const t=localStorage.getItem(k); return t?JSON.parse(t):null; }catch{ return null; } };
  const write = (k,v)=>{ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} };
  return {
    async loadExact(g,s){ return read(KDOC(g,s)); },
    async saveExact(g,s,doc){
      const body = { ...doc, guildId:String(g), updatedAt: Date.now(), version: 2 };
      write(KDOC(g,s), body);
      const idx = read(KIDX(g)) || [];
      if (!idx.find(it=> it.id===s)) idx.push({ id:s, title: body.title || s });
      write(KIDX(g), idx);
      return body;
    },
    async deleteExact(g,s){
      try{ localStorage.removeItem(KDOC(g,s)); }catch{}
      const idx = (read(KIDX(g)) || []).filter(it=> it.id!==s);
      write(KIDX(g), idx);
    },
    async listExact(g){ return (read(KIDX(g)) || []); }
  };
}

/* ---- Lightweight Firebase detection ---- */
function readFirebaseConfig(){
  try {
    if (window.firebaseConfig && typeof window.firebaseConfig==='object') return window.firebaseConfig;
    const m1=document.querySelector('meta[name="firebase-config"]'); if (m1?.content) return JSON.parse(m1.content);
    const m2=document.querySelector('meta[name="kadie-firebase-config"]'); if (m2?.content) return JSON.parse(m2.content);
    const s1=document.getElementById('firebase-config'); if (s1?.textContent) return JSON.parse(s1.textContent);
  } catch {}
  return null;
}

let _fsStore = null;
async function makeFirestoreStore(){
  if (_fsStore) return _fsStore;

  // Compat already present
  if (window.firebase?.firestore) {
    const db = window.firebase.firestore();
    _fsStore = compatStore(db);
    return _fsStore;
  }

  const cfg = readFirebaseConfig();
  if (!cfg) throw new Error('no-firebase-config');

  // Try compat CDN, else ESM CDN
  try {
    await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
    await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js');
    if (!window.firebase?.apps?.length) window.firebase.initializeApp(cfg);
    const db = window.firebase.firestore();
    _fsStore = compatStore(db);
    return _fsStore;
  } catch { /* fall through */ }

  const appMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
  const fsMod  = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
  const app = (appMod.getApps?.().length ? appMod.getApp() : appMod.initializeApp(cfg));
  const db  = fsMod.getFirestore(app);
  _fsStore = esmStore(fsMod, db);
  return _fsStore;
}

function compatStore(db){
  const newDoc = (g,s)=> db.doc(`guilds/${String(g)}/blueprints/${String(s)}`);
  const newCol = (g)=> db.collection(`guilds/${String(g)}/blueprints`);
  const oldDoc = (g,s)=> db.doc(`blueprints/${String(g)}/systems/${String(s)}`);
  const oldCol = (g)=> db.collection(`blueprints/${String(g)}/systems`);
  return {
    async loadExact(g,s){
      const r1 = await newDoc(g,s).get(); if (r1.exists) return r1.data();
      const r2 = await oldDoc(g,s).get(); return r2.exists ? r2.data() : null;
    },
    async saveExact(g,s,doc){
      const body = { ...doc, guildId:String(g), name: doc.title||doc.systemId||String(s), updatedAt: Date.now(), version:2 };
      await newDoc(g,s).set(body, { merge:true });
      return body;
    },
    async deleteExact(g,s){
      try{ await newDoc(g,s).delete(); }catch{}
      try{ await oldDoc(g,s).delete(); }catch{}
    },
    async listExact(g){
      try{
        const q1 = await newCol(g).get();
        const ids1 = q1.docs.map(d=> d.id);
        if (ids1.length) return ids1;
        const q2 = await oldCol(g).get();
        return q2.docs.map(d=> d.id);
      }catch{ return []; }
    }
  };
}

function esmStore(fsMod, db){
  const newDoc = (g,s)=> fsMod.doc(db,'guilds',String(g),'blueprints',String(s));
  const newCol = (g)=> fsMod.collection(db,'guilds',String(g),'blueprints');
  const oldDoc = (g,s)=> fsMod.doc(db,'blueprints',String(g),'systems',String(s));
  const oldCol = (g)=> fsMod.collection(db,'blueprints',String(g),'systems');
  return {
    async loadExact(g,s){
      const r1 = await fsMod.getDoc(newDoc(g,s)); if (r1.exists()) return r1.data();
      const r2 = await fsMod.getDoc(oldDoc(g,s)); return r2.exists() ? r2.data() : null;
    },
    async saveExact(g,s,doc){
      const body = { ...doc, guildId:String(g), name: doc.title||doc.systemId||String(s), updatedAt: Date.now(), version:2 };
      await fsMod.setDoc(newDoc(g,s), body, { merge:true });
      return body;
    },
    async deleteExact(g,s){
      try{ await fsMod.deleteDoc(newDoc(g,s)); }catch{}
      try{ await fsMod.deleteDoc(oldDoc(g,s)); }catch{}
    },
    async listExact(g){
      try{
        const q1 = await fsMod.getDocs(newCol(g));
        const ids1 = q1.docs.map(d=> d.id);
        if (ids1.length) return ids1;
        const q2 = await fsMod.getDocs(oldCol(g));
        return q2.docs.map(d=> d.id);
      }catch{ return []; }
    }
  };
}

async function getExactStore(){
  try { return await makeFirestoreStore(); }
  catch { return makeLocalStore(); }
}

/* ========== Elements (Node service) ========== */
export async function listElements() {
  const url = `${nodeBase()}/blueprints/elements`;
  try {
    const data = await fetchJson(url, { credentials:'omit', mode:'cors' });
    return Array.isArray(data) ? data : (data.elements || data.items || []);
  } catch (e) {
    warn('listElements failed', e?.message || e);
    return [];
  }
}

/* ========== Systems (Python service + Exact store) ========== */
export async function listSystems(guildId) {
  if (!guildId) return [];
  const url = `${PY_API_BASE}/blueprints/${guildId}/systems`;
  const data = await fetchJson(url).catch(()=> []);
  const arr = Array.isArray(data) ? data : (data.items || data.systems || []);
  try {
    const store = await getExactStore();
    if (store.listExact) {
      const localIdx = await store.listExact(guildId);
      const seen = new Set(arr.map(it=> it.id||it.systemId||it.name));
      for (const id of localIdx) if (!seen.has(id)) arr.push({ id, title: id });
    }
  } catch {}
  return arr;
}

export async function loadSystem(guildId, systemId) {
  try {
    const store = await getExactStore();
    const doc = await store.loadExact(guildId, systemId);
    if (doc && doc.data && doc.ui && doc.nodes) return doc;
  } catch { /* fallback */ }
  const url = `${PY_API_BASE}/blueprints/${guildId}/systems/${encodeURIComponent(systemId)}`;
  return await fetchJson(url);
}

export async function saveSystem(guildId, systemId, title, exactDoc) {
  const name = String((title || 'Untitled')).trim();
  const targetId = String(systemId || name);

  // 1) Python store — exec graph only
  try {
    const url = `${PY_API_BASE}/blueprints/${guildId}/systems/${encodeURIComponent(targetId)}`;
    const execGraph = exactDoc?.execGraph || { nodes: [], edges: (exactDoc?.data?.edges || []) };
    const body = JSON.stringify({
      guildId: String(guildId),
      systemId: targetId,
      title: name,
      name,
      description: '',
      icon: '',
      data: execGraph
    });
    const res = await fetch(url, { method:'PUT', headers:{'Content-Type':'application/json'}, body });
    if (!res.ok && res.status !== 404) {
      const t = await res.text().catch(()=> '');
      warn(`Python save nonfatal ${res.status}`, t.slice(0,160));
    }
  } catch { /* ignore */ }

  // 2) Exact store (Firestore or local)
  const store = await getExactStore();
  const body = {
    title: exactDoc.title || name,
    systemId: exactDoc.systemId || targetId,
    entries: Array.isArray(exactDoc.entries) ? exactDoc.entries : [],
    nodes: (exactDoc.nodes && typeof exactDoc.nodes === 'object') ? exactDoc.nodes : {},
    data: { edges: Array.isArray(exactDoc.data?.edges) ? exactDoc.data.edges : [] },
    ui: (exactDoc.ui && typeof exactDoc.ui === 'object') ? exactDoc.ui : undefined
  };
  const saved = await store.saveExact(guildId, targetId, body);
  return { id: targetId, title: saved.title, data: saved.data, ui: saved.ui };
}

export async function deleteSystem(guildId, systemId) {
  try {
    const url = `${PY_API_BASE}/blueprints/${guildId}/systems/${encodeURIComponent(systemId)}`;
    const res = await fetch(url, { method:'DELETE' });
    if (![200,204,404].includes(res.status)) {
      const body = await res.text().catch(()=> '');
      warn(`Python delete ${res.status}`, body.slice(0,160));
    }
  } catch { /* ignore */ }
  try {
    const store = await getExactStore();
    await store.deleteExact(guildId, systemId);
  } catch { /* ignore */ }
}

export async function createSystem(guildId, title, exactDoc){
  return saveSystem(guildId, null, title, exactDoc);
}
