'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { Group, Mesh } from 'three';
import type { AgentState } from '@amc/simulation-engine';
import { AgentVisualState, AgentZone } from '@amc/shared';

const STATE_COLORS: Record<AgentVisualState, string> = {
  [AgentVisualState.Working]: '#2563eb',
  [AgentVisualState.Thinking]: '#7c3aed',
  [AgentVisualState.Blocked]: '#dc2626',
  [AgentVisualState.Communicating]: '#059669',
  [AgentVisualState.Idle]: '#f97316',
};

const SKIN_TONES = ['#f0c8a0', '#d4a574', '#c19a6b', '#8d6e46', '#e8beac', '#f5d0b0'];
const SHIRT_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

interface OfficePersonProps {
  agent: AgentState;
  allAgents: Map<string, AgentState>;
}

export function OfficePerson({ agent }: OfficePersonProps) {
  const groupRef = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);

  // Deterministic appearance from agent ID
  const hash = hashString(agent.id);
  const skinTone = SKIN_TONES[hash % SKIN_TONES.length];
  const shirtColor = SHIRT_COLORS[(hash >> 4) % SHIRT_COLORS.length];
  const stateColor = STATE_COLORS[agent.visualState];

  const isIdle = agent.zone === AgentZone.Idle;
  const isWorking = agent.visualState === AgentVisualState.Working;
  const isBlocked = agent.visualState === AgentVisualState.Blocked;
  const isThinking = agent.visualState === AgentVisualState.Thinking;
  const isCommunicating = agent.visualState === AgentVisualState.Communicating;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const g = groupRef.current;

    // Smooth position interpolation (walking effect)
    const targetX = agent.position.x;
    const targetZ = agent.position.z;
    const speed = isIdle ? 1.5 : 2.5; // idle agents walk slower (strolling)

    g.position.x += (targetX - g.position.x) * delta * speed;
    g.position.z += (targetZ - g.position.z) * delta * speed;

    // Walking bob animation when moving
    const dx = Math.abs(targetX - g.position.x);
    const dz = Math.abs(targetZ - g.position.z);
    const isMoving = dx > 0.05 || dz > 0.05;

    if (isMoving) {
      // Bob up and down while walking
      g.position.y = Math.abs(Math.sin(Date.now() * 0.008)) * 0.05;
      // Face direction of movement
      const angle = Math.atan2(targetX - g.position.x, targetZ - g.position.z);
      g.rotation.y += (angle - g.rotation.y) * delta * 5;
    } else {
      g.position.y = 0;
      // Idle swaying for thinking agents
      if (isThinking) {
        g.rotation.y = Math.sin(Date.now() * 0.001) * 0.1;
      }
    }
  });

  const zoneName = agent.zone === AgentZone.Idle ? 'Coffee Shop'
    : agent.zone === AgentZone.Coding ? 'Dev Area'
    : agent.zone === AgentZone.Testing ? 'QA Lab'
    : agent.zone === AgentZone.Review ? 'Review Room'
    : 'Planning Room';

  return (
    <group
      ref={groupRef}
      position={[agent.position.x, 0, agent.position.z]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* --- Humanoid body --- */}

      {/* Legs */}
      <mesh position={[-0.08, 0.22, 0]} castShadow>
        <capsuleGeometry args={[0.06, 0.25, 4, 8]} />
        <meshStandardMaterial color="#374151" roughness={0.8} />
      </mesh>
      <mesh position={[0.08, 0.22, 0]} castShadow>
        <capsuleGeometry args={[0.06, 0.25, 4, 8]} />
        <meshStandardMaterial color="#374151" roughness={0.8} />
      </mesh>

      {/* Torso */}
      <mesh position={[0, 0.58, 0]} castShadow>
        <capsuleGeometry args={[0.14, 0.22, 4, 8]} />
        <meshStandardMaterial color={shirtColor} roughness={0.7} />
      </mesh>

      {/* Arms */}
      <mesh position={[-0.2, 0.55, 0]} castShadow>
        <capsuleGeometry args={[0.04, 0.2, 4, 8]} />
        <meshStandardMaterial color={shirtColor} roughness={0.7} />
      </mesh>
      <mesh position={[0.2, 0.55, 0]} castShadow>
        <capsuleGeometry args={[0.04, 0.2, 4, 8]} />
        <meshStandardMaterial color={shirtColor} roughness={0.7} />
      </mesh>

      {/* Hands */}
      <mesh position={[-0.2, 0.4, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color={skinTone} />
      </mesh>
      <mesh position={[0.2, 0.4, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color={skinTone} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 0.82, 0]} castShadow>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial color={skinTone} roughness={0.6} />
      </mesh>

      {/* Hair */}
      <mesh position={[0, 0.88, -0.01]}>
        <sphereGeometry args={[0.09, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshStandardMaterial color={hash % 3 === 0 ? '#1c1917' : hash % 3 === 1 ? '#78350f' : '#292524'} />
      </mesh>

      {/* --- State indicators --- */}

      {/* Status ring around feet — animated pulse */}
      <AnimatedRing stateColor={stateColor} isBlocked={isBlocked} isWorking={isWorking} />

      {/* Blocked: red exclamation floating + pulsing above */}
      {isBlocked && <BlockedIndicator />}

      {/* Thinking: animated floating thought bubbles */}
      {isThinking && <ThinkingBubbles />}

      {/* Working: laptop with animated screen glow */}
      {isWorking && !isIdle && <WorkingLaptop stateColor={stateColor} />}

      {/* Communicating: animated expanding speech rings */}
      {isCommunicating && <CommunicatingRings />}

      {/* Coffee cup for idle agents */}
      {isIdle && (
        <mesh position={[0.18, 0.48, 0.05]}>
          <cylinderGeometry args={[0.025, 0.02, 0.06, 8]} />
          <meshStandardMaterial color="#f5f5f4" />
        </mesh>
      )}

      {/* --- Tooltip on hover --- */}
      {hovered && (
        <Html
          position={[0, 1.3, 0]}
          center
          distanceFactor={15}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '10px',
              padding: '10px 14px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
              border: `2px solid ${stateColor}`,
              minWidth: '160px',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: stateColor,
                  boxShadow: `0 0 6px ${stateColor}`,
                }}
              />
              <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                {agent.name}
              </span>
            </div>

            <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.6' }}>
              <div>
                <span style={{ color: '#94a3b8' }}>Status: </span>
                <span style={{ color: stateColor, fontWeight: 600, textTransform: 'capitalize' }}>
                  {agent.visualState}
                </span>
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>Zone: </span>
                <span style={{ color: '#334155' }}>{zoneName}</span>
              </div>
              {agent.currentTask && (
                <div style={{ marginTop: '4px', padding: '4px 6px', background: '#f8fafc', borderRadius: '4px', fontSize: '10px' }}>
                  {agent.currentTask.length > 60
                    ? agent.currentTask.slice(0, 60) + '...'
                    : agent.currentTask}
                </div>
              )}
              <div style={{ marginTop: '6px', display: 'flex', gap: '12px', fontSize: '10px', fontFamily: 'monospace' }}>
                <span>
                  <span style={{ color: '#94a3b8' }}>Tokens: </span>
                  {(agent.tokenUsage.promptTokens + agent.tokenUsage.completionTokens).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </Html>
      )}

      {/* Agent name label (always visible, small) */}
      <Html
        position={[0, 1.05, 0]}
        center
        distanceFactor={20}
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            fontSize: '10px',
            fontWeight: 600,
            color: '#475569',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            textShadow: '0 1px 3px rgba(255,255,255,0.9)',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          {agent.name}
        </div>
      </Html>
    </group>
  );
}

/* --- Animated sub-components --- */

function AnimatedRing({ stateColor, isBlocked, isWorking }: { stateColor: string; isBlocked: boolean; isWorking: boolean }) {
  const ringRef = useRef<Mesh>(null);
  const outerRef = useRef<Mesh>(null);

  useFrame(() => {
    if (!ringRef.current) return;
    const mat = ringRef.current.material as THREE.MeshStandardMaterial;
    const pulse = Math.sin(Date.now() * (isBlocked ? 0.008 : 0.003)) * 0.5 + 0.5;
    mat.emissiveIntensity = isBlocked ? 0.4 + pulse * 0.6 : isWorking ? 0.2 + pulse * 0.3 : 0.3;
    mat.opacity = 0.4 + pulse * 0.3;

    if (outerRef.current) {
      const omat = outerRef.current.material as THREE.MeshStandardMaterial;
      omat.opacity = pulse * 0.15;
      outerRef.current.scale.setScalar(1 + pulse * 0.15);
    }
  });

  return (
    <>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.28, 0.33, 24]} />
        <meshStandardMaterial
          color={stateColor}
          emissive={stateColor}
          emissiveIntensity={0.3}
          transparent
          opacity={0.6}
        />
      </mesh>
      {/* Outer pulse ring */}
      <mesh ref={outerRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <ringGeometry args={[0.33, 0.38, 24]} />
        <meshStandardMaterial
          color={stateColor}
          emissive={stateColor}
          emissiveIntensity={0.2}
          transparent
          opacity={0.1}
        />
      </mesh>
    </>
  );
}

function BlockedIndicator() {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);

  useFrame(() => {
    if (!groupRef.current || !meshRef.current) return;
    const t = Date.now() * 0.004;
    groupRef.current.position.y = 1.15 + Math.sin(t) * 0.05;
    meshRef.current.rotation.y += 0.02;
    meshRef.current.rotation.x = Math.sin(t * 0.7) * 0.2;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.5 + Math.sin(t * 2) * 0.5;
  });

  return (
    <group ref={groupRef} position={[0, 1.15, 0]}>
      <mesh ref={meshRef}>
        <octahedronGeometry args={[0.06, 0]} />
        <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={0.8} />
      </mesh>
      {/* Warning glow halo */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.06, 0.12, 12]} />
        <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={0.3} transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

function ThinkingBubbles() {
  const groupRef = useRef<Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const t = Date.now() * 0.002;
    const children = groupRef.current.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const phase = t + i * 1.2;
      child.position.y = Math.sin(phase) * 0.04;
      child.position.x = 0.15 + i * 0.06 + Math.cos(phase * 0.7) * 0.01;
      const scale = 0.7 + Math.sin(phase * 1.5) * 0.3;
      child.scale.setScalar(scale);
    }
  });

  return (
    <group ref={groupRef} position={[0, 1.0, 0]}>
      <mesh position={[0.15, 0, 0]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#7c3aed" emissive="#7c3aed" emissiveIntensity={0.5} transparent opacity={0.8} />
      </mesh>
      <mesh position={[0.21, 0.06, 0]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color="#7c3aed" emissive="#7c3aed" emissiveIntensity={0.5} transparent opacity={0.7} />
      </mesh>
      <mesh position={[0.25, 0.14, 0]}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshStandardMaterial color="#7c3aed" emissive="#7c3aed" emissiveIntensity={0.5} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

function WorkingLaptop({ stateColor }: { stateColor: string }) {
  const meshRef = useRef<Mesh>(null);

  useFrame(() => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    // Simulate screen flickering like typing
    const flicker = Math.random() > 0.92 ? 0.2 : 0;
    mat.emissiveIntensity = 0.3 + Math.sin(Date.now() * 0.005) * 0.1 + flicker;
  });

  return (
    <mesh ref={meshRef} position={[0, 0.75, -0.2]}>
      <boxGeometry args={[0.2, 0.01, 0.15]} />
      <meshStandardMaterial
        color={stateColor}
        emissive={stateColor}
        emissiveIntensity={0.4}
        transparent
        opacity={0.6}
      />
    </mesh>
  );
}

function CommunicatingRings() {
  const ringsRef = useRef<Group>(null);

  useFrame(() => {
    if (!ringsRef.current) return;
    const children = ringsRef.current.children;
    const t = Date.now() * 0.003;
    for (let i = 0; i < children.length; i++) {
      const phase = (t + i * 0.8) % (Math.PI * 2);
      const scale = 0.5 + (phase / (Math.PI * 2)) * 1.0;
      children[i].scale.setScalar(scale);
      const mat = (children[i] as Mesh).material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.opacity = Math.max(0, 0.6 - (phase / (Math.PI * 2)) * 0.6);
      }
    }
  });

  return (
    <group position={[0.2, 0.95, 0]} ref={ringsRef}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} rotation={[0, 0, Math.PI / 2]}>
          <ringGeometry args={[0.04, 0.055, 12]} />
          <meshStandardMaterial color="#059669" emissive="#059669" emissiveIntensity={0.5} transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

// THREE namespace for type assertions
import * as THREE from 'three';
