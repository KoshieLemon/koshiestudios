import { readTransformOriginPx } from './utils.js';

export class MouseMapper {
  constructor({ layer, viewport }) {
    this.layer = layer;
    this.viewport = viewport;
    this.x = 0; this.y = 0; this.inside = false;

    this._onMove = this._onMove.bind(this);
    this._onLeaveDoc = this._onLeaveDoc.bind(this);

    document.addEventListener('mousemove', this._onMove);
    document.addEventListener('mouseleave', this._onLeaveDoc);
  }

  _onMove(e) {
    const rect = this.layer.getBoundingClientRect();
    const { x: originX, y: originY, matrix } = readTransformOriginPx(this.layer, rect);
    const local = new DOMPoint(e.clientX - originX, e.clientY - originY).matrixTransform(matrix.inverse());

    this.x = local.x;
    this.y = local.y;

    const v = this.viewport.getBoundingClientRect();
    this.inside = e.clientX >= v.left && e.clientX <= v.right && e.clientY >= v.top && e.clientY <= v.bottom;

    this._lastClient = { x: e.clientX, y: e.clientY, target: e.target };
  }

  _onLeaveDoc() { this.inside = false; }

  latestClient() { return this._lastClient || { x: 0, y: 0, target: null }; }

  destroy() {
    document.removeEventListener('mousemove', this._onMove);
    document.removeEventListener('mouseleave', this._onLeaveDoc);
  }
}