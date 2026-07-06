import { Canvas } from '@react-three/fiber';
import type { DieValue } from '@spicy-dicey/core-engine';
import { Die3D } from './Die3D';

interface Props {
  dice: readonly DieValue[];
  rollKey: number;
  selectedIndices: number[];
  reducedMotion?: boolean;
}

/**
 * The visual 3D tray. Interaction stays on the accessible button overlay in
 * DiceTray — this canvas is presentation only.
 */
export function DiceTray3D({ dice, rollKey, selectedIndices, reducedMotion = false }: Props) {
  return (
    <div className="h-32 w-full" data-testid="dice-3d-canvas">
      <Canvas camera={{ position: [(dice.length - 1) * 0.75, 2.2, 5.2], fov: 40 }}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[4, 6, 3]} intensity={1.1} />
        {dice.map((value, i) => (
          <Die3D
            key={i}
            value={value}
            rollKey={rollKey}
            index={i}
            selected={selectedIndices.includes(i)}
            reducedMotion={reducedMotion}
          />
        ))}
      </Canvas>
    </div>
  );
}
