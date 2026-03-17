'use client';

import { Grid } from '@react-three/drei';

export function OfficeFloor() {
  return (
    <group>
      {/* Main floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 5]} receiveShadow>
        <planeGeometry args={[50, 40]} />
        <meshStandardMaterial color="#e8ecf1" roughness={0.8} />
      </mesh>

      {/* Subtle grid overlay for spatial reference */}
      <Grid
        position={[0, 0.005, 5]}
        args={[50, 40]}
        cellSize={2}
        cellThickness={0.4}
        cellColor="#d1d5db"
        sectionSize={10}
        sectionThickness={0.8}
        sectionColor="#cbd5e1"
        fadeDistance={40}
        fadeStrength={1}
        followCamera={false}
      />

      {/* Hallway dividers between zones */}
      {/* Vertical divider */}
      <mesh position={[0, 0.02, -2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.15, 24]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      {/* Horizontal divider */}
      <mesh position={[0, 0.02, 5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[36, 0.15]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>

      {/* Outer walls (subtle) */}
      {/* Back wall */}
      <mesh position={[0, 1.5, -15]}>
        <boxGeometry args={[50, 3, 0.2]} />
        <meshStandardMaterial color="#f1f5f9" />
      </mesh>
      {/* Left wall */}
      <mesh position={[-18, 1.5, 5]}>
        <boxGeometry args={[0.2, 3, 40]} />
        <meshStandardMaterial color="#f1f5f9" />
      </mesh>
      {/* Right wall */}
      <mesh position={[18, 1.5, 5]}>
        <boxGeometry args={[0.2, 3, 40]} />
        <meshStandardMaterial color="#f1f5f9" />
      </mesh>
    </group>
  );
}
