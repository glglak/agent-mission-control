'use client';

import type { WorldState } from '@amc/simulation-engine';
import { AgentCard } from './AgentCard';

interface AgentGridProps {
  worldState: WorldState;
}

export function AgentGrid({ worldState }: AgentGridProps) {
  const agents = Array.from(worldState.agents.values());

  if (agents.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400">
        <div className="text-center">
          <div className="text-4xl mb-2">&#x1f916;</div>
          <p className="text-slate-500">No agents detected yet.</p>
          <p className="text-sm text-slate-400 mt-1">Start a Claude Code session to see agents here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  );
}
