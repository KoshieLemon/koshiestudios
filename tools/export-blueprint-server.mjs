#!/usr/bin/env node
// Local proxy for exporting Kadie blueprints via Firebase Admin.
// GET /health
// GET /list?guildId=...
// GET /export?guildId=...&systemId=...
// Env: PORT (default 8787)
// Creds: argv[2] path|'-'|inlineJSON OR GOOGLE_APPLICATION_CREDENTIALS path|inlineJSON OR FIREBASE_SERVICE_ACCOUNT_JSON inlineJSON

import http from "node:http";
import fs from "node:fs";
import url from "node:url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function jtry(s){ try{ return JSON.parse(s); }catch{ return null; } }
function loadCreds(arg){
  if (arg) {
    if (arg === "-") { const t = fs.readFileSync(0,"utf8"); const j=jtry(t); if(!j) throw Error("stdin not JSON"); return j; }
    if (arg.trim().startsWith("{")) { const j=jtry(arg); if(!j) throw Error("inline creds invalid"); return j; }
    return JSON.parse(fs.readFileSync(arg,"utf8"));
  }
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (gac) {
    if (gac.trim().startsWith("{")) { const j=jtry(gac); if(!j) throw Error("GOOGLE_APPLICATION_CREDENTIALS invalid JSON"); return j; }
    return JSON.parse(fs.readFileSync(gac,"utf8"));
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) { const j=jtry(raw); if(!j) throw Error("FIREBASE_SERVICE_ACCOUNT_JSON invalid JSON"); return j; }
  throw Error("No credentials provided");
}
const creds = loadCreds(process.argv[2]);
initializeApp({ credential: cert(creds) });
const db = getFirestore();

const PORT = Number(process.env.PORT || 8787);

function json(res, code, obj){
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  });
  res.end(body);
}
function toExact(doc, systemId){
  return {
    title: doc?.title ?? "",
    systemId: doc?.systemId ?? String(systemId),
    entries: Array.isArray(doc?.entries) ? doc.entries : [],
    nodes: (doc?.nodes && typeof doc.nodes==="object") ? doc.nodes : {},
    data: { edges: Array.isArray(doc?.data?.edges) ? doc.data.edges : [] },
    ui: doc?.ui || undefined
  };
}
async function listIds(guildId){
  const c1 = await db.collection(`guilds/${String(guildId)}/blueprints`).get();
  if (c1.docs.length) return c1.docs.map(d=> d.id);
  const c2 = await db.collection(`blueprints/${String(guildId)}/systems`).get();
  return c2.docs.map(d=> d.id);
}
async function exportOne(guildId, systemId){
  const r1 = db.doc(`guilds/${String(guildId)}/blueprints/${String(systemId)}`);
  const s1 = await r1.get(); if (s1.exists) return toExact(s1.data(), systemId);
  const r2 = db.doc(`blueprints/${String(guildId)}/systems/${String(systemId)}`);
  const s2 = await r2.get(); return s2.exists ? toExact(s2.data(), systemId) : null;
}

http.createServer(async (req, res) => {
  try {
    const u = url.parse(req.url, true);
    if (u.pathname === "/health") return json(res, 200, { ok: true, projectId: db.projectId });
    if (u.pathname === "/list") {
      const g = u.query.guildId; if (!g) return json(res, 400, { error: "guildId required" });
      const ids = await listIds(g); return json(res, 200, { guildId: g, systems: ids });
    }
    if (u.pathname === "/export") {
      const g = u.query.guildId, s = u.query.systemId;
      if (!g || !s) return json(res, 400, { error: "guildId and systemId required" });
      const doc = await exportOne(g, s);
      if (!doc) return json(res, 404, { error: "not found" });
      return json(res, 200, doc);
    }
    json(res, 404, { error: "route" });
  } catch (e) {
    json(res, 500, { error: String(e?.message||e) });
  }
}).listen(PORT, () => {
  console.log(`[export-proxy] http://localhost:${PORT} project=${db.projectId}`);
});
