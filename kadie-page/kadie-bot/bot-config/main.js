// main.js — bootstrap
import { state, setGuild, setEditorEnabled } from './state.js';
import { renderHeader } from './ui-header.js';
import { refreshSystems } from './ui-systems.js';
import { loadElementsSidebar } from './ui-elements.js';
import { renderAll } from './canvas/index.js';
import { getJSON, params, log } from './config.js';
import { wireUnsavedBar } from './ui-unsaved.js';

(function init(){
  // Guild from URL or storage
  const gid = params.guild || params.guild_id || params.g || '';
  const guilds = getJSON(['discord.guilds','discordGuilds']) || [];
  const guild = guilds.find(x => String(x.id) === String(gid));
  setGuild(gid, guild || null);

  renderHeader();
  loadElementsSidebar().catch(()=>{});
  refreshSystems().catch(()=>{});

  if (!state.currentSystemId) setEditorEnabled(false);

  // Build canvas once
  renderAll();
  wireUnsavedBar();

  log('init done');
})();
