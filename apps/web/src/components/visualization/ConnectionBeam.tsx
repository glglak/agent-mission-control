'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import type { Group, Mesh } from 'three';
import * as THREE from 'three';

interface ConnectionBeamProps {
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  decay: number;
}

export function ConnectionBeam({ from, to, decay }: ConnectionBeamProps) {
  const groupRef = useRef<Group>(null);
  const pulseRef = useRef<Mesh>(null);
  const progressRef = useRef(0);

  const dist = Math.sqrt((to.x - from.x) ** 2 + (to.z - from.z) ** 2);
  const arcHeight = 1.2 + dist * 0.05;

  // Memoize the arc points
  const points = useMemo(() => {
    const segments = 24;
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = from.x + (to.x - from.x) * t;
      const z = from.z + (to.z - from.z) * t;
      const y = 0.9 + Math.sin(t * Math.PI) * arcHeight;
      pts.push([x, y, z]);
    }
    return pts;
  }, [from.x, from.z, to.x, to.z, arcHeight]);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.visible = decay > 0.05;
    }

    // Animate the traveling pulse
    if (pulseRef.current && decay > 0.05) {
      progressRef.current = (progressRef.current + delta * 1.2) % 1;
      const t = progressRef.current;
      const x = from.x + (to.x - from.x) * t;
      const z = from.z + (to.z - from.z) * t;
      const y = 0.9 + Math.sin(t * Math.PI) * arcHeight;
      pulseRef.current.position.set(x, y, z);

      const mat = pulseRef.current.material as THREE.MeshStandardMaterial;
      // Brighter in the middle of the arc
      mat.emissiveIntensity = 0.5 + Math.sin(t * Math.PI) * 0.5;
      const scale = 0.04 + Math.sin(t * Math.PI) * 0.03;
      pulseRef.current.scale.setScalar(scale / 0.04);
    }
  });

  if (decay < 0.05) return null;

  return (
    <group ref={groupRef}>
      {/* Main beam line */}
      <Line
        points={points}
        color="#059669"
        lineWidth={2.5}
        transparent
        opacity={Math.max(0.15, decay * 0.7)}
        dashed
        dashSize={0.2}
        gapSize={0.1}
      />
      {/* Glow line underneath */}
      <Line
        points={points}
        color="#34d399"
        lineWidth={5}
        transparent
        opacity={Math.max(0.05, decay * 0.15)}
      />
      {/* Traveling pulse particle */}
      <mesh ref={pulseRef} position={[from.x, 0.9, from.z]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial
          color="#34d399"
          emissive="#34d399"
          emissiveIntensity={0.8}
          transparent
          opacity={decay * 0.9}
        />
      </mesh>
    </group>
  );
}
