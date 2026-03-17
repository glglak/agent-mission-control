'use client';

import { Text } from '@react-three/drei';
import type { AgentZone } from '@amc/shared';

interface OfficeZoneProps {
  zone: AgentZone;
  position: [number, number, number];
  size: [number, number]; // width, depth
  color: string;
  label: string;
}

export function OfficeZone({ position, size, color, label }: OfficeZoneProps) {
  return (
    <group position={position}>
      {/* Zone floor - slightly raised, colored */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[size[0], size[1]]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.06}
          roughness={0.9}
        />
      </mesh>

      {/* Zone border - colored lines */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[Math.min(size[0], size[1]) * 0.48, Math.min(size[0], size[1]) * 0.49, 4]} />
        <meshStandardMaterial color={color} transparent opacity={0.2} />
      </mesh>

      {/* Zone accent strip on floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, -size[1] / 2 + 0.15]}>
        <planeGeometry args={[size[0] * 0.9, 0.3]} />
        <meshStandardMaterial color={color} transparent opacity={0.4} />
      </mesh>

      {/* Zone label - on the accent strip */}
      <Text
        position={[0, 0.06, -size[1] / 2 + 0.15]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.5}
        color={color}
        anchorX="center"
        anchorY="middle"
        font={undefined}
        fontWeight="bold"
      >
        {label}
      </Text>

      {/* Subtle colored glow pillar at corner */}
      <mesh position={[-size[0] / 2 + 0.3, 0.5, -size[1] / 2 + 0.3]}>
        <cylinderGeometry args={[0.08, 0.08, 1, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh position={[size[0] / 2 - 0.3, 0.5, -size[1] / 2 + 0.3]}>
        <cylinderGeometry args={[0.08, 0.08, 1, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  );
}
