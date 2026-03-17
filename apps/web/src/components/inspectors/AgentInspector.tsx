'use client';

import type { WorldState } from '@amc/simulation-engine';
import { useUIStore } from '@/stores/ui-store';
import { useSessionStore } from '@/stores/session-store';

interface AgentInspectorProps {
  worldState: WorldState;
}

export function AgentInspector({ worldState }: AgentInspectorProps) {
  const selectedAgentId = useUIStore((s) => s.selectedAgentId);
  const events = useSessionStore((s) => s.events);

  if (!selectedAgentId) {
    return (
      <div className="p-4 text-sm text-slate-400">
        Select an agent to inspect
      </div>
    );
  }

  const agent = worldState.agents.get(selectedAgentId);
  if (!agent) {
    return (
      <div className="p-4 text-sm text-slate-400">
        Agent not found
      </div>
    );
  }

  const agentEvents = events.filter((e) => e.agent_id === selectedAgentId).slice(-20);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-slate-200">
        <h3 className="font-semibold text-slate-800">{agent.name}</h3>
        <div className="text-xs text-slate-500 mt-1 space-y-0.5">
          <div>ID: <span className="font-mono">{agent.id.slice(0, 16)}...</span></div>
          <div>Zone: <span className="capitalize">{agent.zone}</span></div>
          <div>State: <span className="capitalize">{agent.visualState}</span></div>
          {agent.currentTask && <div>Task: {agent.currentTask}</div>}
        </div>
      </div>

      <div className="p-4 border-b border-slate-200">
        <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Token Usage</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-slate-400">Prompt:</span>{' '}
            <span className="font-mono text-blue-600">{agent.tokenUsage.promptTokens.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-slate-400">Completion:</span>{' '}
            <span className="font-mono text-purple-600">{agent.tokenUsage.completionTokens.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Recent Events</h4>
        <div className="space-y-1">
          {agentEvents.map((event) => (
            <div
              key={event.event_id}
              className="text-xs p-2 bg-slate-50 rounded border border-slate-100"
            >
              <div className="flex justify-between">
                <span className="text-slate-700 font-mono">{event.event_type}</span>
                <span className="text-slate-400">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
          {agentEvents.length === 0 && (
            <div className="text-slate-400 text-xs">No events yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
