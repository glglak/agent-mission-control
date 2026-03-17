'use client';

import { Text } from '@react-three/drei';

interface CoffeeShopProps {
  position: [number, number, number];
}

export function CoffeeShop({ position }: CoffeeShopProps) {
  return (
    <group position={position}>
      {/* Warm floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[26, 7]} />
        <meshStandardMaterial color="#fef3c7" transparent opacity={0.3} roughness={0.9} />
      </mesh>

      {/* Coffee bar counter */}
      <mesh position={[0, 0.5, -2.5]} castShadow receiveShadow>
        <boxGeometry args={[8, 1, 0.6]} />
        <meshStandardMaterial color="#92400e" roughness={0.7} />
      </mesh>
      {/* Counter top */}
      <mesh position={[0, 1.02, -2.5]} castShadow>
        <boxGeometry args={[8.2, 0.04, 0.7]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.3} metalness={0.1} />
      </mesh>

      {/* Coffee machine */}
      <mesh position={[-2.5, 1.3, -2.5]} castShadow>
        <boxGeometry args={[0.4, 0.5, 0.3]} />
        <meshStandardMaterial color="#374151" metalness={0.4} roughness={0.5} />
      </mesh>

      {/* Coffee cups on counter */}
      {[-1, 0, 1, 2].map((x, i) => (
        <mesh key={i} position={[x, 1.12, -2.5]}>
          <cylinderGeometry args={[0.06, 0.05, 0.12, 8]} />
          <meshStandardMaterial color="#f5f5f4" roughness={0.6} />
        </mesh>
      ))}

      {/* Round tables for idle agents */}
      {[
        [-6, 0, 0], [-3, 0, 1], [0, 0, 0.5], [3, 0, 1], [6, 0, 0],
      ].map((pos, i) => (
        <group key={i} position={[pos[0], 0, pos[1] + pos[2]]}>
          {/* Table surface */}
          <mesh position={[0, 0.65, 0]} castShadow>
            <cylinderGeometry args={[0.5, 0.5, 0.04, 16]} />
            <meshStandardMaterial color="#fef3c7" roughness={0.4} />
          </mesh>
          {/* Table leg */}
          <mesh position={[0, 0.32, 0]}>
            <cylinderGeometry args={[0.04, 0.06, 0.64, 8]} />
            <meshStandardMaterial color="#78716c" metalness={0.4} />
          </mesh>
          {/* Stools */}
          <mesh position={[0.5, 0.35, 0.3]} castShadow>
            <cylinderGeometry args={[0.18, 0.18, 0.04, 12]} />
            <meshStandardMaterial color="#f97316" transparent opacity={0.7} />
          </mesh>
          <mesh position={[-0.5, 0.35, -0.3]} castShadow>
            <cylinderGeometry args={[0.18, 0.18, 0.04, 12]} />
            <meshStandardMaterial color="#f97316" transparent opacity={0.7} />
          </mesh>
        </group>
      ))}

      {/* Label */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, -3.2]}>
        <planeGeometry args={[6, 0.3]} />
        <meshStandardMaterial color="#f97316" transparent opacity={0.4} />
      </mesh>
      <Text
        position={[0, 0.06, -3.2]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.5}
        color="#ea580c"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        COFFEE SHOP
      </Text>

      {/* Plant decorations */}
      {[[-10, 0, -1], [10, 0, -1]].map((pos, i) => (
        <group key={i} position={[pos[0], 0, pos[2]]}>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.2, 0.15, 0.5, 8]} />
            <meshStandardMaterial color="#a3a3a3" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.65, 0]}>
            <sphereGeometry args={[0.35, 8, 8]} />
            <meshStandardMaterial color="#22c55e" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
