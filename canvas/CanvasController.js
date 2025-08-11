// Universal canvas: one source of truth for pan/scale across BOTH bg + grid
export class CanvasController {
  constructor({ camera, wrapper, viewport }) {
    this.camera = camera;
    this.wrapper = wrapper;
    this.viewport = viewport;

    this.panX = 0;
    this.panY = 0;
    this.scale = 1;
  }

  setOffset(x, y) {
    this.panX = x; this.panY = y;
    this.wrapper.style.setProperty('--pan-x', `${x}px`);
    this.wrapper.style.setProperty('--pan-y', `${y}px`);
    this.camera .style.setProperty('--pan-x', `${x}px`);
    this.camera .style.setProperty('--pan-y', `${y}px`);
  }

  setScale(v) {
    this.scale = v;
    this.wrapper.style.setProperty('--scale', String(v));
    this.camera .style.setProperty('--scale', String(v));
  }

  resetOffset() { this.setOffset(0, 0); }
  resetScale()  { this.setScale(1); }

  setCursor(c) { this.wrapper.style.cursor = c; }

  setTransitionsEnabled(enabled) {
    // wrapper transform easing (return animation)
    this.wrapper.style.transition = enabled
      ? 'transform var(--return-dur) var(--ease)'
      : 'none';
    // background transitions controlled by .viewport.dragging CSS
    this.viewport.classList.toggle('dragging', !enabled);
  }

  // Big page-open zoom (separate from micro-press scale)
  setZoom({ s, originX, originY }) {
    this.camera.style.setProperty('--origin-x', `${originX}px`);
    this.camera.style.setProperty('--origin-y', `${originY}px`);
    this.camera.style.setProperty('--s', String(s));
    this.camera.classList.add('zoom');
  }
  clearZoom() {
    this.camera.classList.remove('zoom');
    this.camera.style.removeProperty('--origin-x');
    this.camera.style.removeProperty('--origin-y');
    this.camera.style.removeProperty('--s');
  }

  onCameraTransitionEnd(fn) {
    const handler = (ev) => fn(ev);
    this.camera.addEventListener('transitionend', handler);
    return () => this.camera.removeEventListener('transitionend', handler);
  }

  /* Back-compat aliases */
  setDragScale(v) { this.setScale(v); }
  setBgScale(v)   { this.setScale(v); }
}
