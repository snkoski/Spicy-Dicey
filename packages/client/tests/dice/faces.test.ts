import { describe, expect, it } from 'vitest';
import { PIP_LAYOUTS, faceRotation } from '../../src/features/dice/faces';
import type { DieValue } from '@spicy-dicey/core-engine';

const ALL_VALUES: DieValue[] = [1, 2, 3, 4, 5, 6];

describe('PIP_LAYOUTS (2D)', () => {
  it('has the right pip count for every face', () => {
    for (const value of ALL_VALUES) {
      expect(PIP_LAYOUTS[value]).toHaveLength(value);
    }
  });

  it('pips sit on the 3x3 grid', () => {
    for (const value of ALL_VALUES) {
      for (const [row, col] of PIP_LAYOUTS[value]) {
        expect([0, 1, 2]).toContain(row);
        expect([0, 1, 2]).toContain(col);
      }
    }
  });
});

describe('faceRotation (3D)', () => {
  it('maps every engine value to a distinct rotation', () => {
    const seen = new Set(ALL_VALUES.map((v) => JSON.stringify(faceRotation(v))));
    expect(seen.size).toBe(6);
  });

  it('rotations bring the requested face to +Y ("up")', () => {
    // The die model puts: 1 on +Y, 6 on -Y, 2 on +X, 5 on -X, 3 on +Z, 4 on -Z.
    // faceRotation(v) must rotate the die so face v points up. Verify by
    // rotating each face's home normal and checking it lands on (0,1,0).
    const HOME_NORMALS: Record<DieValue, [number, number, number]> = {
      1: [0, 1, 0],
      6: [0, -1, 0],
      2: [1, 0, 0],
      5: [-1, 0, 0],
      3: [0, 0, 1],
      4: [0, 0, -1],
    };
    for (const value of ALL_VALUES) {
      const [rx, ry, rz] = faceRotation(value);
      const rotated = rotateVector(HOME_NORMALS[value], rx, ry, rz);
      expect(rotated[0]).toBeCloseTo(0, 10);
      expect(rotated[1]).toBeCloseTo(1, 10);
      expect(rotated[2]).toBeCloseTo(0, 10);
    }
  });
});

/** Apply intrinsic XYZ euler rotation (three.js default order). */
function rotateVector(
  [x, y, z]: [number, number, number],
  rx: number,
  ry: number,
  rz: number,
): [number, number, number] {
  // rotate around X
  let [px, py, pz] = [x, y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  // rotate around Y
  [px, py, pz] = [
    px * Math.cos(ry) + pz * Math.sin(ry),
    py,
    -px * Math.sin(ry) + pz * Math.cos(ry),
  ];
  // rotate around Z
  [px, py, pz] = [px * Math.cos(rz) - py * Math.sin(rz), px * Math.sin(rz) + py * Math.cos(rz), pz];
  return [px, py, pz];
}
