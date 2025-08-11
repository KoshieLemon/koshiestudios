// Tiny tooltip that follows the cursor.
// Usage: const tip = new Tooltip("This item is not yet available");
//        tip.attachAll(document.querySelectorAll('.cell.disabled'));

export class Tooltip {
  constructor(text = 'This item is not yet available') {
    this.text = text;
    this.visible = false;
    this.x = 0; this.y = 0;
    this.offsetX = 16;
    this.offsetY = 18;

    const el = document.createElement('div');
    el.id = 'cell-tooltip';
    el.textContent = this.text;
    document.body.appendChild(el);
    this.el = el;

    this._onMove = this._onMove.bind(this);
    window.addEventListener('pointermove', this._onMove, { passive: true });
  }

  setText(t) {
    this.text = String(t);
    this.el.textContent = this.text;
  }

  show() { this.visible = true; this._render(); }
  hide() { this.visible = false; this.el.style.transform = 'translate(-9999px,-9999px)'; }

  attach(node) {
    node.addEventListener('pointerenter', () => this.show());
    node.addEventListener('pointerleave', () => this.hide());
  }
  attachAll(nodes) { nodes.forEach(n => this.attach(n)); }

  _onMove(e) {
    this.x = e.clientX; this.y = e.clientY;
    if (this.visible) this._render();
  }

  _render() {
    let nx = this.x + this.offsetX;
    let ny = this.y + this.offsetY;
    const r = this.el.getBoundingClientRect();
    const pad = 8;
    if (nx + r.width + pad > window.innerWidth)  nx = this.x - r.width - this.offsetX;
    if (ny + r.height + pad > window.innerHeight) ny = this.y - r.height - this.offsetY;
    this.el.style.transform = `translate(${nx}px, ${ny}px)`;
  }

  destroy() {
    window.removeEventListener('pointermove', this._onMove);
    this.el?.remove();
  }
}
export default Tooltip;
