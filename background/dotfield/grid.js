// Virtualized dot grid with TOP-LEFT origin (matches CSS).
// Visible local range comes from: screen = scale * local + pan
//   => localX ∈ [(-panX)/scale, (vw - panX)/scale]
//   => localY ∈ [(-panY)/scale, (vh - panY)/scale]
// Dots use CSS variables for position so CSS can apply inverse scale (size stays constant).

export class VirtualGrid {
  constructor({
    layer, camera, viewport, spacing, size, color,
    updatePanThreshold = 0.25,
    updateScaleThreshold = 0.01
  }) {
    this.layer = layer;
    this.camera = camera;
    this.viewport = viewport;
    this.spacing = spacing;
    this.size = size;
    this.color = color;

    this.last = { panX: 0, panY: 0, scale: 1, vw: 0, vh: 0 };
    this.panThresholdPx = Math.max(1, this.spacing * updatePanThreshold);
    this.scaleThreshold = updateScaleThreshold;

    this.map = new Map();
    this.list = [];
    this.pool = [];
  }

  getDots() { return this.list; }

  updateIfNeeded() {
    const cs = getComputedStyle(this.camera);
    const scale = parseFloat(cs.getPropertyValue('--scale')) || 1;
    const panX  = parseFloat(cs.getPropertyValue('--pan-x')) || 0;
    const panY  = parseFloat(cs.getPropertyValue('--pan-y')) || 0;

    const vw = this.viewport.clientWidth  || window.innerWidth  || 1920;
    const vh = this.viewport.clientHeight || window.innerHeight || 1080;

    const need =
      Math.abs(panX - this.last.panX) > this.panThresholdPx ||
      Math.abs(panY - this.last.panY) > this.panThresholdPx ||
      Math.abs(scale - this.last.scale) > this.scaleThreshold ||
      vw !== this.last.vw || vh !== this.last.vh;

    if (!need && this.list.length) return;

    this.last = { panX, panY, scale, vw, vh };

    const minLocalX = (-panX) / scale;
    const maxLocalX = (vw - panX) / scale;
    const minLocalY = (-panY) / scale;
    const maxLocalY = (vh - panY) / scale;

    const guard = 1;
    const cellMinX = Math.floor(minLocalX / this.spacing) - guard;
    const cellMaxX = Math.ceil (maxLocalX / this.spacing) + guard;
    const cellMinY = Math.floor(minLocalY / this.spacing) - guard;
    const cellMaxY = Math.ceil (maxLocalY / this.spacing) + guard;

    const needed = new Set();
    for (let iy = cellMinY; iy <= cellMaxY; iy++) {
      for (let ix = cellMinX; ix <= cellMaxX; ix++) {
        const key = `${ix},${iy}`;
        needed.add(key);
        if (!this.map.has(key)) this._add(ix, iy);
      }
    }

    for (const [key, dot] of this.map) {
      if (!needed.has(key)) this._remove(key, dot);
    }

    this.list.length = 0;
    for (const d of this.map.values()) this.list.push(d);

    if (!this.list.length) {
      const cix = Math.round(((vw/2) - panX) / (scale * this.spacing));
      const ciy = Math.round(((vh/2) - panY) / (scale * this.spacing));
      this._add(cix, ciy);
    }
  }

  _add(ix, iy) {
    const x = ix * this.spacing;
    const y = iy * this.spacing;

    const el = this.pool.pop() || (() => {
      const n = document.createElement('div');
      n.className = 'dot';
      return n;
    })();

    el.style.width = `${this.size}px`;
    el.style.height = `${this.size}px`;
    el.style.background = this.color;
    el.style.setProperty('--x', `${x}px`);
    el.style.setProperty('--y', `${y}px`);

    this.layer.appendChild(el);

    const dot = { el, x, y, ox: x, oy: y, vx: 0, vy: 0, r: Math.hypot(x, y) };
    this.map.set(`${ix},${iy}`, dot);
    return dot;
  }

  _remove(key, dot) {
    this.map.delete(key);
    if (dot?.el && dot.el.parentNode === this.layer) {
      this.layer.removeChild(dot.el);
      dot.vx = dot.vy = 0;
      this.pool.push(dot.el);
    }
  }
}
