#!/usr/bin/env node
// tools/export-blueprint-admin.mjs
// Usage:
//   node tools/export-blueprint-admin.mjs <guildId> <systemId> /path/serviceAccount.json
// or set GOOGLE_APPLICATION_CREDENTIALS to the JSON path.

import fs from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function main(){
  const [,, guildId, systemId, credsPath] = process.argv;
  if (!guildId || !systemId) {
    console.error('usage: node tools/export-blueprint-admin.mjs <guildId> <systemId> [serviceAccount.json]');
    process.exit(1);
  }
  const p = credsPath || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!p) { console.error('Missing service account JSON path'); process.exit(1); }

  const creds = JSON.parse(fs.readFileSync(p, 'utf8'));
  initializeApp({ credential: cert(creds) });

  const db = getFirestore();
  const ref = db.doc(`blueprints/${String(guildId)}/systems/${String(systemId)}`);
  const snap = await ref.get();
  if (!snap.exists) { console.error('Not found'); process.exit(2); }

  const doc = snap.data() || {};
  const out = {
    title: doc.title ?? '',
    systemId: doc.systemId ?? String(systemId),
    entries: Array.isArray(doc.entries) ? doc.entries : [],
    nodes: doc.nodes || {},
    data: { edges: (doc?.data?.edges || []) },
    ui: doc.ui || undefined
  };
  console.log(JSON.stringify(out, null, 2));
}
main().catch(e => { console.error(e.stack||e.message||String(e)); process.exit(1); });
