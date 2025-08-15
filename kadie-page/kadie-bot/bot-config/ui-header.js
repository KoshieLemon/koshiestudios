// ui-header.js — Render server header card + back button
// COMPLETE FILE (tweaked to use state.guild and be resilient if guilds are missing)

import { $, SERVERS_PAGE, iconUrl, log } from './config.js';
import { state } from './state.js';

function fallbackGuildFromStorage(id){
  try {
    const raw = sessionStorage.getItem('discord.guilds') || localStorage.getItem('discord.guilds');
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    return arr.find(g => String(g.id) === String(id)) || null;
  } catch { return null; }
}

export function renderHeader() {
  // Prefer state.guild if present; otherwise try to recover from storage using state.guildId
  let g = state.guild || fallbackGuildFromStorage(state.guildId);
  log('renderHeader for', g?.id, g?.name);

  const nameEl = $('#svName');
  const idEl   = $('#svId');
  nameEl.textContent = g?.name || '(Unknown server)';
  idEl.textContent   = g?.id   || '—';

  const u = iconUrl(g);
  const iconBox = $('#svIcon');
  iconBox.innerHTML = '';
  if (u) {
    const img = new Image(); img.src = u; img.alt = '';
    iconBox.appendChild(img);
  } else {
    const dot = document.createElement('div');
    dot.style.width='20px'; dot.style.height='20px';
    dot.style.borderRadius='6px'; dot.style.background='rgba(255,255,255,.14)';
    iconBox.appendChild(dot);
  }

  $('#backBtn').onclick = () => { log('back → servers'); window.location.href = SERVERS_PAGE; };
}

// Also re-render if guild changes after page load
window.addEventListener('bp:guild-changed', () => renderHeader());
