export const defaultConfig = {
  spacing: 56,                 // px between dots
  margin: 1200,                // extra coverage around viewport (px)
  size: 2,                     // dot size in px
  color: 'rgba(255,255,255,.28)',

  // physics — SHORTER radius so you should notice it immediately
  influence: (spacing) => Math.max(120, spacing * 1.8),
  maxDisp:   (spacing) => Math.min(26, spacing * 0.55),
  springK: 0.055,
  damping: 0.86,
  repelK: 120,

  // twinkle cadence (ms)
  twinkleMin: 180,
  twinkleMax: 900,

  // cursor
  cursor: {
    size: 26,
    zIndex: 999999,
    border: '1px solid rgba(255,255,255,.25)',
    bg: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,.15) 0%, rgba(255,255,255,0) 60%)',
    hotBorder: 'rgba(255,255,255,.9)',
    hotGlow: '0 0 18px rgba(255,255,255,.38)'
  }
};
