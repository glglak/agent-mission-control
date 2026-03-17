'use client';

import { useMemo } from 'react';
import ReactFlow, {
  type Node,
  type Edge,
  Background,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { WorldState } from '@amc/simulation-engine';
import { AgentVisualState } from '@amc/shared';

const stateColors: Record<AgentVisualState, string> = {
  [AgentVisualState.Working]: '#2563eb',
  [AgentVisualState.Thinking]: '#7c3aed',
  [AgentVisualState.Blocked]: '#dc2626',
  [AgentVisualState.Communicating]: '#059669',
  [AgentVisualState.Idle]: '#94a3b8',
};

interface CommunicationGraphProps {
  worldState: WorldState;
}

export function CommunicationGraph({ worldState }: CommunicationGraphProps) {
  const { nodes, edges } = useMemo(() => {
    const agents = Array.from(worldState.agents.values());
    const cols = Math.ceil(Math.sqrt(agents.length));

    const nodes: Node[] = agents.map((agent, i) => ({
      id: agent.id,
      position: { x: (i % cols) * 200, y: Math.floor(i / cols) * 120 },
      data: {
        label: (
          <div className="text-center">
            <div className="font-semibold text-slate-800 text-xs">{agent.name}</div>
            <div className="text-[10px] capitalize" style={{ color: stateColors[agent.visualState] }}>
              {agent.visualState}
            </div>
          </div>
        ),
      },
      style: {
        background: '#ffffff',
        border: `2px solid ${stateColors[agent.visualState]}`,
        borderRadius: '8px',
        padding: '8px 12px',
        minWidth: '120px',
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.07)',
      },
    }));

    const edges: Edge[] = worldState.connections.map((conn) => ({
      id: conn.id,
      source: conn.fromAgentId,
      target: conn.toAgentId,
      animated: conn.decay > 0.5,
      style: {
        stroke: '#059669',
        strokeWidth: 2,
        opacity: Math.max(0.2, conn.decay),
      },
    }));

    return { nodes, edges };
  }, [worldState]);

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden" style={{ height: 300 }}>
      <div className="px-4 py-2 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
          Communication Graph
        </h3>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        proOptions={{ hideAttribution: true }}
        style={{ background: '#ffffff' }}
      >
        <Background variant={BackgroundVariant.Dots} color="#e2e8f0" gap={20} />
      </ReactFlow>
    </div>
  );
}
