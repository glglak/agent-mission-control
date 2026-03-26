'use client';

import type { AgentState } from '@amc/simulation-engine';
import { AgentVisualState } from '@amc/shared';
import { useUIStore } from '@/stores/ui-store';

const stateColors: Record<AgentVisualState, string> = {
  [AgentVisualState.Working]: 'border-l-amc-working',
  [AgentVisualState.Thinking]: 'border-l-amc-thinking',
  [AgentVisualState.Blocked]: 'border-l-amc-blocked',
  [AgentVisualState.Communicating]: 'border-l-amc-communicating',
  [AgentVisualState.Idle]: 'border-l-amc-idle',
};

const stateLabels: Record<AgentVisualState, string> = {
  [AgentVisualState.Working]: 'Working',
  [AgentVisualState.Thinking]: 'Thinking',
  [AgentVisualState.Blocked]: 'Blocked',
  [AgentVisualState.Communicating]: 'Communicating',
  [AgentVisualState.Idle]: 'Idle',
};

const stateBadgeColors: Record<AgentVisualState, string> = {
  [AgentVisualState.Working]: 'bg-blue-50 text-blue-700',
  [AgentVisualState.Thinking]: 'bg-purple-50 text-purple-700',
  [AgentVisualState.Blocked]: 'bg-red-50 text-red-700',
  [AgentVisualState.Communicating]: 'bg-emerald-50 text-emerald-700',
  [AgentVisualState.Idle]: 'bg-slate-100 text-slate-600',
};

interface AgentCardProps {
  agent: AgentState;
}

export function AgentCard({ agent }: AgentCardProps) {
  const { selectedAgentId, selectAgent } = useUIStore();
  const isSelected = selectedAgentId === agent.id;

  return (
    <div
      onClick={() => selectAgent(isSelected ? null : agent.id)}
      className={`
        relative p-4 rounded-lg bg-white border-l-4 cursor-pointer transition-all duration-200
        shadow-sm hover:shadow-md
        ${stateColors[agent.visualState]}
        ${isSelected ? 'ring-2 ring-amc-accent ring-offset-2' : ''}
      `}
    >
      {/* Pulse animation for working state */}
      {agent.visualState === AgentVisualState.Working && (
        <div className="absolute inset-0 rounded-lg border border-blue-200 animate-ping opacity-20" />
      )}

      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-slate-800 truncate">{agent.name}</h3>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${stateBadgeColors[agent.visualState]}`}
        >
          {stateLabels[agent.visualState]}
        </span>
      </div>

      <div className="text-xs text-slate-500 space-y-1">
        <div>
          Zone: <span className="text-slate-700 capitalize">{agent.zone}</span>
        </div>
        {agent.currentTask && (
          <div className="truncate">
            Task: <span className="text-slate-700">{agent.currentTask}</span>
          </div>
        )}
      </div>

    </div>
  );
}
