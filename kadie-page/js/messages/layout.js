// Robust character layout: measures every visible glyph from the .dtext,
// preserving wrapping and font metrics, and returns absolute positions
// relative to the scene.

export async function layoutCharsAsLine(sceneEl, lineLayerEl, dtextEl){
  const sceneRect = sceneEl.getBoundingClientRect();
  const srcRect   = dtextEl.getBoundingClientRect();
  const cs        = getComputedStyle(dtextEl);

  // Scratch container positioned over the original text (relative to scene)
  const scratch = document.createElement('div');
  scratch.style.position      = 'absolute';
  scratch.style.left          = (srcRect.left - sceneRect.left) + 'px';
  scratch.style.top           = (srcRect.top  - sceneRect.top ) + 'px';
  scratch.style.width         = srcRect.width + 'px';
  scratch.style.whiteSpace    = 'pre-wrap';
  scratch.style.visibility    = 'hidden';     // don't flash
  scratch.style.pointerEvents = 'none';
  // Match typography exactly so wraps/metrics align
  scratch.style.font          = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`;
  scratch.style.letterSpacing = cs.letterSpacing;
  scratch.style.wordBreak     = cs.wordBreak;
  scratch.style.lineBreak     = cs.lineBreak;
  scratch.style.textTransform = cs.textTransform;

  lineLayerEl.appendChild(scratch);

  const text = (dtextEl.textContent ?? '').toString();
  const letters = [];

  if (text.length === 0){
    scratch.remove();
    return { letters: [] };
  }

  // Build per-char spans so we can measure each glyph rect
  // Use NBSP for spaces so they occupy width.
  for (let i=0; i<text.length; i++){
    const ch = text[i] === ' ' ? '\u00A0' : text[i];
    const span = document.createElement('span');
    span.textContent = ch;
    scratch.appendChild(span);
  }

  // Measure
  for (let i=0; i<scratch.childNodes.length; i++){
    const node = scratch.childNodes[i];
    if (!(node instanceof HTMLElement)) continue;
    const r = node.getBoundingClientRect();
    letters.push({
      ch: (node.textContent === '\u00A0' ? ' ' : node.textContent),
      x:  r.left - sceneRect.left,
      y:  r.top  - sceneRect.top  + r.height * 0.8  // bias toward baseline
    });
  }

  scratch.remove();
  return { letters };
}
