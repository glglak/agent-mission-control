'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { Mesh } from 'three';
import * as THREE from 'three';
import type { FileNodeState } from '@amc/simulation-engine';
import { ZONE_LAYOUTS } from '@amc/simulation-engine';
import { AgentZone } from '@amc/shared';

interface FileNodeProps {
  fileNode: FileNodeState;
}

// Color by file extension
function getFileColor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'ts': case 'tsx': return '#3178c6';
    case 'js': case 'jsx': return '#f7df1e';
    case 'json': return '#a3a3a3';
    case 'css': case 'scss': return '#ce679a';
    case 'md': return '#083fa1';
    case 'py': return '#3572A5';
    case 'sql': return '#e38c00';
    default: return '#f59e0b';
  }
}

// Icon shape by category
function getFileIcon(path: string): 'octahedron' | 'dodecahedron' | 'icosahedron' {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  if (['ts', 'tsx', 'js', 'jsx', 'py'].includes(ext)) return 'icosahedron';
  if (['json', 'yaml', 'toml'].includes(ext)) return 'octahedron';
  return 'dodecahedron';
}

export function FileNode({ fileNode }: FileNodeProps) {
  const meshRef = useRef<Mesh>(null);
  const intensity = fileNode.glowIntensity;
  const color = getFileColor(fileNode.path);

  // Place file nodes floating above the coding zone
  const codingZone = ZONE_LAYOUTS[AgentZone.Coding];
  const hash = fileNode.path.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const x = codingZone.center.x + ((hash % 12) - 6) * 0.8;
  const z = codingZone.center.z + (((hash >> 4) % 8) - 4) * 0.6;
  const shape = getFileIcon(fileNode.path);

  useFrame(() => {
    if (!meshRef.current) return;
    // Gentle floating + spin animation
    meshRef.current.position.y = 2.0 + Math.sin(Date.now() * 0.002 + hash) * 0.15;
    const baseScale = 0.08 + intensity * 0.12 + Math.min(fileNode.editCount * 0.02, 0.1);
    // Pulse scale when recently edited
    const pulse = intensity > 0.5 ? Math.sin(Date.now() * 0.006) * 0.02 : 0;
    meshRef.current.scale.setScalar(baseScale + pulse);
    meshRef.current.rotation.y += 0.008;
    meshRef.current.rotation.x += 0.002;

    // Update emissive intensity
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = intensity * 0.4 + (intensity > 0.5 ? Math.sin(Date.now() * 0.004) * 0.2 : 0);
  });

  if (intensity < 0.01) return null;

  const fileName = fileNode.path.split('/').pop() ?? fileNode.path;

  return (
    <group position={[x, 2, z]}>
      <mesh ref={meshRef}>
        {shape === 'icosahedron' && <icosahedronGeometry args={[1, 0]} />}
        {shape === 'octahedron' && <octahedronGeometry args={[1, 0]} />}
        {shape === 'dodecahedron' && <dodecahedronGeometry args={[1, 0]} />}
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={intensity * 0.5}
          transparent
          opacity={0.3 + intensity * 0.5}
          roughness={0.3}
          metalness={0.2}
        />
      </mesh>
      {/* Inner glow core */}
      {intensity > 0.3 && (
        <mesh position={[0, 2.0 + Math.sin(hash) * 0.1, 0]}>
          <sphereGeometry args={[0.03 + intensity * 0.04, 8, 8]} />
          <meshStandardMaterial
            color="white"
            emissive={color}
            emissiveIntensity={intensity}
            transparent
            opacity={intensity * 0.4}
          />
        </mesh>
      )}
      {intensity > 0.15 && (
        <Html
          position={[0, 0.4, 0]}
          center
          distanceFactor={20}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              fontSize: '9px',
              color: '#334155',
              whiteSpace: 'nowrap',
              fontFamily: 'monospace',
              background: 'rgba(255,255,255,0.9)',
              padding: '2px 6px',
              borderRadius: '4px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
              borderLeft: `2px solid ${color}`,
            }}
          >
            {fileName}
            {fileNode.editCount > 1 && (
              <span style={{ color: '#94a3b8', marginLeft: '4px' }}>x{fileNode.editCount}</span>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}
