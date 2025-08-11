// Physics: update dot positions; write CSS variables --x/--y instead of transform,
// so CSS can keep dot size constant with inverse scale.

export function stepPhysics(dots, mouse, cfg) {
  const { x: mx, y: my, inside } = mouse || {};
  const k = cfg.springK;
  const dmp = cfg.damping;
  const repelK = cfg.repelK;
  const maxDisp = cfg.maxDisp;
  const R = cfg.influence;

  for (const d of dots) {
    // spring toward origin
    let ax = (d.ox - d.x) * k;
    let ay = (d.oy - d.y) * k;

    // repel from mouse
    if (inside) {
      const dx = d.x - mx;
      const dy = d.y - my;
      const r2 = dx*dx + dy*dy;
      if (r2 > 0 && r2 < R*R) {
        const r = Math.sqrt(r2);
        const f = repelK * (1 - r / R); // smooth falloff (only push away)
        ax += (dx / r) * f;
        ay += (dy / r) * f;
      }
    }

    // integrate
    d.vx = (d.vx + ax) * dmp;
    d.vy = (d.vy + ay) * dmp;
    d.x += d.vx;
    d.y += d.vy;

    // clamp displacement
    const dxo = d.x - d.ox;
    const dyo = d.y - d.oy;
    const disp = Math.hypot(dxo, dyo);
    if (disp > maxDisp) {
      const s = maxDisp / disp;
      d.x = d.ox + dxo * s;
      d.y = d.oy + dyo * s;
      d.vx *= 0.6; d.vy *= 0.6;
    }

    // write CSS vars
    d.el.style.setProperty('--x', `${d.x}px`);
    d.el.style.setProperty('--y', `${d.y}px`);
  }
}
