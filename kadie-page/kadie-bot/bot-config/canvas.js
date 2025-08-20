// canvas.js — compatibility shim
// Many parts of the app import from "./canvas.js".
// Re-export the modular implementation so view.js is actually loaded/wired.

export * from "./canvas/index.js";
// Ensure named re-export for environments where index.js wasn't refreshed yet.
export { centerOnGraph } from "./canvas/view.js";
