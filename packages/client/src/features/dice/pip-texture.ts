import type { DieValue } from '@spicy-dicey/core-engine';
import { PIP_LAYOUTS } from './faces';

/**
 * Canvas-drawn pip faces for the 3D dice (plan §1 Phase 3: no external
 * assets). The painter takes a minimal context interface so the drawing
 * logic is testable without a real canvas.
 */
export interface FacePainterContext {
  fillStyle: string;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  fill(): void;
}

export function paintDieFace(ctx: FacePainterContext, value: DieValue, size: number): void {
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, size, size);

  const cell = size / 4; // grid positions at 1/4, 2/4, 3/4
  const radius = size / 12;
  ctx.fillStyle = '#0f172a';
  for (const [row, col] of PIP_LAYOUTS[value]) {
    ctx.beginPath();
    ctx.arc(cell * (col + 1), cell * (row + 1), radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Browser-only: bake one face into a canvas for use as a texture. */
export function createFaceCanvas(value: DieValue, size = 128): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    paintDieFace(ctx, value, size);
  }
  return canvas;
}
