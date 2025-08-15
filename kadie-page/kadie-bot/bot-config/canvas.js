// canvas.js — compatibility shim
// Many parts of the app import from "./canvas.js".
// Re-export the modular implementation so view.js is actually loaded/wired.

export * from "./canvas/index.js";
