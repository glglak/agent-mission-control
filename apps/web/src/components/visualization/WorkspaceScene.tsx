'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { Suspense } from 'react';
import type { WorldState } from '@amc/simulation-engine';
import { ZONE_LAYOUTS } from '@amc/simulation-engine';
import { AgentZone } from '@amc/shared';
import { OfficePerson } from './OfficePerson';
import { OfficeZone } from './OfficeZone';
import { OfficeDesk } from './OfficeDesk';
import { CoffeeShop } from './CoffeeShop';
import { ConnectionBeam } from './ConnectionBeam';
import { FileNode } from './FileNode';
import { OfficeFloor } from './OfficeFloor';

interface WorkspaceSceneProps {
  worldState: WorldState;
}

const WORK_ZONES = [AgentZone.Planning, AgentZone.Coding, AgentZone.Testing, AgentZone.Review];

export function WorkspaceScene({ worldState }: WorkspaceSceneProps) {
  const agents = Array.from(worldState.agents.values());
  const fileNodes = Array.from(worldState.fileNodes.values());

  return (
    <div className="w-full h-full rounded-xl overflow-hidden shadow-md border border-slate-200">
      <Canvas
        camera={{ position: [0, 25, 35], fov: 45 }}
        style={{ background: '#f0f4f8' }}
        shadows
      >
        <Suspense fallback={null}>
          {/* Bright office lighting */}
          <ambientLight intensity={0.6} />
          <directionalLight
            position={[15, 25, 15]}
            intensity={0.8}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-far={60}
            shadow-camera-left={-30}
            shadow-camera-right={30}
            shadow-camera-top={30}
            shadow-camera-bottom={-30}
          />
          <directionalLight position={[-10, 20, -10]} intensity={0.3} />
          <hemisphereLight intensity={0.4} color="#87ceeb" groundColor="#f0f0f0" />

          {/* Office floor */}
          <OfficeFloor />

          {/* Work zones */}
          {WORK_ZONES.map((zone) => {
            const layout = ZONE_LAYOUTS[zone];
            return (
              <OfficeZone
                key={zone}
                zone={zone}
                position={[layout.center.x, 0, layout.center.z]}
                size={[layout.size.width, layout.size.depth]}
                color={layout.color}
                label={layout.label}
              />
            );
          })}

          {/* Coffee shop for idle agents */}
          <CoffeeShop
            position={[
              ZONE_LAYOUTS[AgentZone.Idle].center.x,
              0,
              ZONE_LAYOUTS[AgentZone.Idle].center.z,
            ]}
          />

          {/* Desks in work zones */}
          {WORK_ZONES.map((zone) => {
            const layout = ZONE_LAYOUTS[zone];
            const deskPositions = [
              { x: -4, z: -2 }, { x: -1, z: -2 }, { x: 2, z: -2 }, { x: 5, z: -2 },
              { x: -4, z: 2 }, { x: -1, z: 2 }, { x: 2, z: 2 }, { x: 5, z: 2 },
            ];
            return deskPositions.map((d, i) => (
              <OfficeDesk
                key={`${zone}-desk-${i}`}
                position={[layout.center.x + d.x, 0, layout.center.z + d.z]}
                color={layout.color}
              />
            ));
          })}

          {/* Agent figures */}
          {agents.map((agent) => (
            <OfficePerson key={agent.id} agent={agent} allAgents={worldState.agents} />
          ))}

          {/* Communication beams */}
          {worldState.connections.map((conn) => {
            const fromAgent = worldState.agents.get(conn.fromAgentId);
            const toAgent = worldState.agents.get(conn.toAgentId);
            if (!fromAgent || !toAgent) return null;
            return (
              <ConnectionBeam
                key={conn.id}
                from={fromAgent.position}
                to={toAgent.position}
                decay={conn.decay}
              />
            );
          })}

          {/* File nodes near coding zone */}
          {fileNodes.slice(0, 30).map((node) => (
            <FileNode key={node.path} fileNode={node} />
          ))}

          <OrbitControls
            enableDamping
            dampingFactor={0.08}
            maxPolarAngle={Math.PI / 2.3}
            minPolarAngle={0.2}
            minDistance={8}
            maxDistance={60}
            target={[0, 0, 5]}
          />

          <Environment preset="city" />
        </Suspense>
      </Canvas>
    </div>
  );
}
