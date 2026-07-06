import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { CanvasTexture, Euler, MathUtils, Quaternion, type Mesh } from 'three';
import type { DieValue } from '@spicy-dicey/core-engine';
import { faceRotation } from './faces';
import { createFaceCanvas } from './pip-texture';

/** Materials order for a box: +X, -X, +Y, -Y, +Z, -Z — matches the die
 * model in faces.ts (2 on +X, 5 on -X, 1 on +Y, 6 on -Y, 3 on +Z, 4 on -Z). */
const FACE_ORDER: DieValue[] = [2, 5, 1, 6, 3, 4];

const TUMBLE_SECONDS = 0.9;

interface Props {
  value: DieValue;
  /** Changes on every roll so the tumble replays even for repeat values. */
  rollKey: number;
  index: number;
  selected: boolean;
  reducedMotion?: boolean;
}

/**
 * Visual layer only: the die always settles on the engine-provided value via
 * the tested faceRotation mapping — the animation can never change a result.
 */
export function Die3D({ value, rollKey, index, selected, reducedMotion = false }: Props) {
  const mesh = useRef<Mesh>(null);
  const startedAt = useRef<number | null>(null);
  const lastRollKey = useRef(rollKey);

  const textures = useMemo(
    () => FACE_ORDER.map((face) => new CanvasTexture(createFaceCanvas(face))),
    [],
  );

  const target = useMemo(() => {
    const [rx, ry, rz] = faceRotation(value);
    return new Quaternion().setFromEuler(new Euler(rx, ry, rz, 'XYZ'));
  }, [value]);

  // Deterministic per-die tumble start orientation (no Math.random — the
  // engine owns all randomness; this is pure presentation).
  const spinStart = useMemo(() => {
    const seed = (index + 1) * 2.399963; // golden-angle spread
    return new Quaternion().setFromEuler(
      new Euler(seed % Math.PI, (seed * 1.7) % Math.PI, (seed * 2.3) % Math.PI, 'XYZ'),
    );
  }, [index]);

  useFrame(({ clock }) => {
    if (!mesh.current) {
      return;
    }
    if (lastRollKey.current !== rollKey) {
      lastRollKey.current = rollKey;
      startedAt.current = null;
    }
    if (reducedMotion) {
      mesh.current.quaternion.copy(target);
      return;
    }
    startedAt.current ??= clock.elapsedTime;
    const t = MathUtils.clamp((clock.elapsedTime - startedAt.current) / TUMBLE_SECONDS, 0, 1);
    const eased = 1 - (1 - t) ** 3;
    mesh.current.quaternion.slerpQuaternions(spinStart, target, eased);
    if (t < 1) {
      // extra tumble on top of the slerp while in flight
      mesh.current.rotateX((1 - t) * 0.35);
      mesh.current.rotateY((1 - t) * 0.25);
    }
  });

  return (
    <RoundedBox
      ref={mesh}
      args={[1, 1, 1]}
      radius={0.12}
      smoothness={4}
      position={[index * 1.5, 0, 0]}
    >
      {textures.map((texture, i) => (
        <meshStandardMaterial
          key={i}
          attach={`material-${i}`}
          map={texture}
          emissive={selected ? '#2563eb' : '#000000'}
          emissiveIntensity={selected ? 0.35 : 0}
        />
      ))}
    </RoundedBox>
  );
}
