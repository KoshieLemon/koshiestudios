// Connected ribbon flow — hurricane pull into the eye, with blue glitch near capture.
// - Whole sentence moves as one snake (length-preserving).
// - Head starts straight, spiral ramps in near the end (constant angular velocity).
// - Letters only disappear AFTER they are fully inside an eye (shrink-into-pupil).
// - Color shifts to blue as letters approach; subtle flicker/glitch near the eye.
// Tweakable via options, but safe defaults are baked in.

export async function animateCharSnakeHybrid(scene, msgEl, lineLayerEl, layout, eyeEl, options = {}) {
  const cfg = {
    // Slower overall timing (scaled by distance from text centroid to eye)
    totalBaseMs: options.totalBaseMs ?? 4800,
    distScaleMs: options.distScaleMs ?? 0.70,

    // Spiral behaviour (eye is fixed center)
    angularVelRPS: options.spiral?.angularVelRPS ?? 0.58, // constant angular velocity
    radialPow:     options.spiral?.radialPow     ?? 1.85, // how the radius collapses
    endRadius:     options.spiral?.endRadius     ?? 10,   // orbit radius at t≈1
    spiralStart:   options.spiral?.start         ?? 0.35, // when spiral starts blending in
    spiralEnd:     options.spiral?.end           ?? 0.92, // when spiral fully dominates

    // Visuals
    unblurMax:     options.unblurMax ?? 6,       // px of blur that lifts off over travel
    fadeNear:      options.fadeNear  ?? 22,      // safety fade if needed (we mostly rely on swallow)
    // Blue shift + glitch
    blueRadius:    options.blueRadius ?? 260,    // distance over which we lerp color to blue
    glitchRadius:  options.glitchRadius ?? 220,  // distance within which flicker/glitch can happen
    glitchAmp:     options.glitchAmp ?? 1.0,     // intensity multiplier for glitch FX
    glitchFreq:    options.glitchFreq ?? 0.025,  // Hz-ish (via time-based sin)
    // Swallow (inside eye) settings
    swallowScaleMs: options.swallowScaleMs ?? 160 // shrink duration once inside pupil
  };

  const sceneRect = scene.getBoundingClientRect();
  const eyeRect   = eyeEl.getBoundingClientRect();
  const eye = {
    x: eyeRect.left + eyeRect.width  / 2 - sceneRect.left,
    y: eyeRect.top  + eyeRect.height / 2 - sceneRect.top
  };

  // Define "inside the eye" radius — a fraction of the eye image width
  const SWALLOW_R = Math.max(cfg.endRadius + 6, Math.min(eyeRect.width, eyeRect.height) * 0.22);

  const lettersIn = (layout && (layout.letters || layout.chars)) || [];
  if (!lettersIn.length) { await glitchFadeOut(msgEl); return; }

  // Typography from the source message to match perfectly
  const msgText = msgEl.querySelector('.dtext');
  const cs = msgText ? getComputedStyle(msgText) : null;
  const font = cs ? `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}` : '16px ui-sans-serif';
  const baseColorStr = cs ? cs.color : '#d6e1ff';
  const baseRGB = parseColorRGB(baseColorStr) || {r:214,g:225,b:255};
  const blueRGB = { r:120, g:180, b:255 }; // target neon-blue
  const letterSpacing = cs ? parsePx(cs.letterSpacing) ?? 0 : 0;

  // Create clones at the exact glyph positions
  const clones = [];
  for (let i=0; i<lettersIn.length; i++){
    const spec = lettersIn[i];
    const span = document.createElement('span');
    span.className = 'flowchar';
    span.textContent = (spec.ch ?? spec.char ?? spec.t ?? ' ');
    span.style.position = 'absolute';
    span.style.font = font;
    span.style.color = baseColorStr;
    span.style.letterSpacing = (cs ? cs.letterSpacing : 'normal');
    span.style.willChange = 'transform, filter, opacity, color, text-shadow';
    span.style.opacity = '1';
    const sx = (spec.x ?? spec.sx ?? 0);
    const sy = (spec.y ?? spec.sy ?? 0);
    span.style.transform = `translate3d(${sx}px, ${sy}px, 0)`;
    lineLayerEl.appendChild(span);
    clones.push({ el: span, sx, sy, w: 0, swallowedAt: 0, removed:false });
  }

  // Hide source AFTER cloning
  if (msgText) msgText.style.visibility = 'hidden';

  // Measure widths to maintain ribbon connectivity
  const MIN_CHAR_W = Math.max(4, parsePx(cs?.fontSize) * 0.45 || 7);
  for (let i=0; i<clones.length; i++){
    const r = clones[i].el.getBoundingClientRect();
    clones[i].w = Math.max(MIN_CHAR_W, r.width);
  }

  // Build cumulative offsets along the ribbon
  const offsets = [];
  let acc = 0;
  for (let i=0; i<clones.length; i++){
    offsets[i] = acc;
    acc += clones[i].w + letterSpacing;
  }
  const tailLength = acc;

  // Use text centroid as the head's start
  const centroid = centroidOf(clones);

  // Duration scaled by distance from centroid to eye
  const distHead = Math.hypot(centroid.x - eye.x, centroid.y - eye.y);
  const totalDuration = cfg.totalBaseMs + distHead * cfg.distScaleMs;

  // Spiral math
  const angVel = (cfg.angularVelRPS * Math.PI * 2) / 1000; // rad/ms
  const baseAngle = Math.atan2(eye.y - centroid.y, eye.x - centroid.x);

  // Head path history (for length-based trailing)
  const history = []; // [{x,y,len}]
  let lastX = centroid.x, lastY = centroid.y, lastLen = 0;

  const t0 = performance.now();
  let removedCount = 0;

  await new Promise(resolve => {
    function frame(now){
      const elapsed = now - t0;
      const t = clamp(elapsed / totalDuration, 0, 1);

      // Head straight approach
      const hpx = lerp(centroid.x, eye.x, t);
      const hpy = lerp(centroid.y, eye.y, t);

      // Head spiral around fixed eye
      const r0 = Math.max(10, distHead);
      const r  = cfg.endRadius + (r0 - cfg.endRadius) * Math.pow(1 - t, cfg.radialPow);
      const th = baseAngle + angVel * elapsed;
      const hsx = eye.x + Math.cos(th) * r;
      const hsy = eye.y + Math.sin(th) * r;

      // Mix straight→spiral over [spiralStart, spiralEnd]
      const mix = smoothRamp(t, cfg.spiralStart, cfg.spiralEnd);
      let hx = lerp(hpx, hsx, mix);
      let hy = lerp(hpy, hsy, mix);

      // Subtle tangential wind wobble near the end
      const wob = noise2D(13.37, now * 0.002) * 8 * (1 - t);
      const tanX = -(hy - eye.y), tanY = (hx - eye.x);
      const tanLen = Math.hypot(tanX, tanY) || 1;
      hx += (tanX / tanLen) * wob;
      hy += (tanY / tanLen) * wob;

      // Update head path history length
      const seg = Math.hypot(hx - lastX, hy - lastY);
      if (history.length === 0 || seg > 0.2) {
        lastLen += seg;
        history.push({ x: hx, y: hy, len: lastLen });
        lastX = hx; lastY = hy;
        while (history.length && (lastLen - history[0].len) > tailLength + 220) history.shift();
      }

      // Position characters along the ribbon
      for (let i=0; i<clones.length; i++){
        const it = clones[i];
        if (it.removed) continue;

        const targetLen = lastLen - offsets[i];
        const p = sampleHistory(history, targetLen);
        if (!p){
          // Not enough history accumulated yet; leave at initial position
          continue;
        }

        // Distance to eye
        const dEye = Math.hypot(p.x - eye.x, p.y - eye.y);

        // Color shift to blue as we approach (over blueRadius)
        const blueT = clamp(1 - (dEye / cfg.blueRadius), 0, 1);
        const col = mixRGB(baseRGB, blueRGB, blueT);
        it.el.style.color = `rgb(${col.r|0}, ${col.g|0}, ${col.b|0})`;

        // Blue glitch/flicker near the eye (inside glitchRadius)
        const gInt = clamp(1 - dEye / cfg.glitchRadius, 0, 1) * cfg.glitchAmp;
        if (gInt > 0){
          // flicker via sine-based pulsing and small random offsets for "tearing"
          const pulse = 0.5 + 0.5 * Math.sin((now + i*73) * cfg.glitchFreq * 2*Math.PI);
          const gl = gInt * pulse;
          const jitterX = (noise2D(i*7.1, now*0.012) * 1.2) * gl;
          const jitterY = (noise2D(i*9.9, now*0.013) * 1.2) * gl;
          // apply as text-shadows to get luminous blue smear
          const glowA = (0.25 + 0.35 * gl).toFixed(3);
          const glowB = (0.15 + 0.25 * gl).toFixed(3);
          it.el.style.textShadow =
            `0 0 6px rgba(120,180,255,${glowA}), ` +
            `0 0 14px rgba(90,150,255,${glowB}), ` +
            `${(1+jitterX).toFixed(2)}px ${(0.5+jitterY).toFixed(2)}px 2px rgba(150,200,255,${(0.1+0.15*gl).toFixed(3)})`;
        } else {
          it.el.style.textShadow = 'none';
        }

        // Unblur progressively
        const sharp = clamp(1 - (dEye / distHead), 0, 1);
        it.el.style.filter = `blur(${(cfg.unblurMax * (1 - sharp)).toFixed(2)}px)`;

        // If inside pupil, start the "swallow" shrink and then remove
        if (!it.swallowedAt && dEye <= SWALLOW_R){
          it.swallowedAt = now;
        }

        // Compose transform with optional scale when swallowing
        let scale = 1;
        if (it.swallowedAt){
          const sT = clamp((now - it.swallowedAt) / cfg.swallowScaleMs, 0, 1);
          scale = 1 - easeOutCubic(sT); // shrink to 0
          if (sT >= 1){
            // remove the letter completely
            it.removed = true;
            try{ lineLayerEl.removeChild(it.el); }catch{}
            removedCount++;
            continue;
          }
        }

        it.el.style.opacity = it.swallowedAt ? String(Math.max(0, scale)) : '1';
        it.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) scale(${scale})`;
      }

      // Finish when every glyph has been swallowed & removed
      if (removedCount >= clones.length){
        resolve();
      } else {
        requestAnimationFrame(frame);
      }
    }
    requestAnimationFrame(frame);
  });
}

/* ----------------- Helpers ----------------- */

function centroidOf(clones){
  let sx=0, sy=0;
  for (const c of clones){ sx += c.sx; sy += c.sy; }
  const n = Math.max(1, clones.length);
  return { x: sx/n, y: sy/n };
}

function sampleHistory(hist, targetLen){
  if (!hist.length) return null;
  if (targetLen <= 0) return { x: hist[0].x, y: hist[0].y };
  const last = hist[hist.length-1];
  if (targetLen >= last.len) return { x: last.x, y: last.y };

  // binary search by cumulative length
  let lo = 0, hi = hist.length - 1;
  while (lo < hi){
    const mid = (lo + hi) >> 1;
    if (hist[mid].len < targetLen) lo = mid + 1; else hi = mid;
  }
  const i = Math.max(1, lo);
  const a = hist[i-1], b = hist[i];
  const segLen = b.len - a.len || 1;
  const t = (targetLen - a.len) / segLen;
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

function smoothRamp(t, a, b){
  if (t <= a) return 0;
  if (t >= b) return 1;
  const u = (t - a) / Math.max(1e-6, (b - a));
  return u*u*(3 - 2*u); // smoothstep
}

/* Color helpers */
function parseColorRGB(str){
  if (!str) return null;
  str = String(str).trim();
  // rgb/rgba
  let m = str.match(/^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (m) return { r: +m[1], g: +m[2], b: +m[3] };
  // #rgb/#rrggbb
  m = str.replace('#','').trim();
  if (/^[0-9a-f]{3}$/i.test(m)){
    const r = parseInt(m[0]+m[0],16), g = parseInt(m[1]+m[1],16), b = parseInt(m[2]+m[2],16);
    return { r,g,b };
  }
  if (/^[0-9a-f]{6}$/i.test(m)){
    const r = parseInt(m.slice(0,2),16), g = parseInt(m.slice(2,4),16), b = parseInt(m.slice(4,6),16);
    return { r,g,b };
  }
  return null;
}
function mixRGB(a,b,t){
  return { r: a.r + (b.r - a.r)*t, g: a.g + (b.g - a.g)*t, b: a.b + (b.b - a.b)*t };
}

function lerp(a,b,t){ return a + (b - a) * t; }
function clamp(v,a,b){ return v < a ? a : (v > b ? b : v); }
function parsePx(v){ if (!v) return null; const n = parseFloat(v); return Number.isFinite(n) ? n : null; }
function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }

// tiny deterministic noise
function noise2D(x, y){
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
  return (s - Math.floor(s)) - 0.5;
}

/* Fallback glitch if we ever have 0 letters (shouldn’t happen with robust layout) */
async function glitchFadeOut(card){
  try{
    card.style.transition = 'filter 300ms ease, opacity 300ms ease';
    card.style.filter = 'url(#cardWarpHeavy) contrast(1.4) saturate(1.3)';
    await nextFrame();
    card.style.opacity = '0';
    await sleep(260);
  }catch{}
}
function nextFrame(){ return new Promise(r=>requestAnimationFrame(()=>r())); }
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
