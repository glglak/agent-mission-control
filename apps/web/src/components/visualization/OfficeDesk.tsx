'use client';

interface OfficeDeskProps {
  position: [number, number, number];
  color: string;
}

export function OfficeDesk({ position, color }: OfficeDeskProps) {
  return (
    <group position={position}>
      {/* Desk surface */}
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.05, 0.7]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.3} metalness={0.1} />
      </mesh>

      {/* Desk legs */}
      {[[-0.5, 0, -0.25], [0.5, 0, -0.25], [-0.5, 0, 0.25], [0.5, 0, 0.25]].map(
        (legPos, i) => (
          <mesh
            key={i}
            position={[legPos[0], 0.35, legPos[2]]}
            castShadow
          >
            <cylinderGeometry args={[0.02, 0.02, 0.7, 6]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.5} roughness={0.4} />
          </mesh>
        )
      )}

      {/* Monitor */}
      <mesh position={[0, 1.05, -0.15]} castShadow>
        <boxGeometry args={[0.5, 0.35, 0.02]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} />
      </mesh>
      {/* Monitor screen */}
      <mesh position={[0, 1.05, -0.138]}>
        <planeGeometry args={[0.44, 0.29]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.15}
        />
      </mesh>
      {/* Monitor stand */}
      <mesh position={[0, 0.87, -0.15]} castShadow>
        <cylinderGeometry args={[0.03, 0.06, 0.15, 8]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} />
      </mesh>

      {/* Chair */}
      <mesh position={[0, 0.4, 0.5]} castShadow>
        <boxGeometry args={[0.45, 0.05, 0.45]} />
        <meshStandardMaterial color="#334155" roughness={0.8} />
      </mesh>
      {/* Chair back */}
      <mesh position={[0, 0.65, 0.7]} castShadow>
        <boxGeometry args={[0.45, 0.5, 0.05]} />
        <meshStandardMaterial color="#334155" roughness={0.8} />
      </mesh>
      {/* Chair pedestal */}
      <mesh position={[0, 0.2, 0.5]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.4, 6]} />
        <meshStandardMaterial color="#475569" metalness={0.5} />
      </mesh>
    </group>
  );
}
