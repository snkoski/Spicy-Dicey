import type { DieValue } from '@spicy-dicey/core-engine';

/**
 * Pure value→face mappings shared by the 2D and 3D dice. The 3D layer only
 * consumes these — it can never change a result (plan §1 Phase 3 acceptance:
 * mapping testable independently of R3F).
 */

/** Pip positions on a 3x3 grid, [row, col], for each face value. */
export const PIP_LAYOUTS: Record<DieValue, ReadonlyArray<readonly [number, number]>> = {
  1: [[1, 1]],
  2: [
    [0, 2],
    [2, 0],
  ],
  3: [
    [0, 2],
    [1, 1],
    [2, 0],
  ],
  4: [
    [0, 0],
    [0, 2],
    [2, 0],
    [2, 2],
  ],
  5: [
    [0, 0],
    [0, 2],
    [1, 1],
    [2, 0],
    [2, 2],
  ],
  6: [
    [0, 0],
    [0, 2],
    [1, 0],
    [1, 2],
    [2, 0],
    [2, 2],
  ],
};

const HALF_PI = Math.PI / 2;

/**
 * Euler rotation (XYZ order, radians) that brings `value`'s face to +Y (up).
 * Die model: 1 on +Y, 6 on -Y, 2 on +X, 5 on -X, 3 on +Z, 4 on -Z —
 * opposite faces sum to 7, like a real die.
 */
export function faceRotation(value: DieValue): [number, number, number] {
  switch (value) {
    case 1:
      return [0, 0, 0];
    case 6:
      return [Math.PI, 0, 0];
    case 2:
      return [0, 0, HALF_PI]; // +X -> +Y
    case 5:
      return [0, 0, -HALF_PI]; // -X -> +Y
    case 3:
      return [-HALF_PI, 0, 0]; // +Z -> +Y
    case 4:
      return [HALF_PI, 0, 0]; // -Z -> +Y
  }
}
