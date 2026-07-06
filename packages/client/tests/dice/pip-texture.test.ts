import { describe, expect, it } from 'vitest';
import { paintDieFace, type FacePainterContext } from '../../src/features/dice/pip-texture';
import type { DieValue } from '@spicy-dicey/core-engine';

function recordingContext() {
  const circles: Array<[number, number, number]> = [];
  const rects: Array<[number, number, number, number]> = [];
  const ctx: FacePainterContext = {
    fillStyle: '',
    fillRect: (x, y, w, h) => void rects.push([x, y, w, h]),
    beginPath: () => {},
    arc: (x, y, r) => void circles.push([x, y, r]),
    fill: () => {},
  };
  return { ctx, circles, rects };
}

describe('paintDieFace', () => {
  it.each([1, 2, 3, 4, 5, 6] as DieValue[])('face %d draws that many pips', (value) => {
    const { ctx, circles, rects } = recordingContext();
    paintDieFace(ctx, value, 128);
    expect(rects).toHaveLength(1); // the face background
    expect(circles).toHaveLength(value);
  });

  it('pips stay inside the face bounds', () => {
    for (const value of [1, 2, 3, 4, 5, 6] as DieValue[]) {
      const { ctx, circles } = recordingContext();
      paintDieFace(ctx, value, 128);
      for (const [x, y, r] of circles) {
        expect(x - r).toBeGreaterThanOrEqual(0);
        expect(x + r).toBeLessThanOrEqual(128);
        expect(y - r).toBeGreaterThanOrEqual(0);
        expect(y + r).toBeLessThanOrEqual(128);
      }
    }
  });

  it('uses the shared PIP_LAYOUTS grid (center pip for odd faces)', () => {
    const { ctx, circles } = recordingContext();
    paintDieFace(ctx, 1, 128);
    expect(circles[0]![0]).toBe(64);
    expect(circles[0]![1]).toBe(64);
  });
});
