'use client';

import type { WorldState } from '@amc/simulation-engine';

interface CostDashboardProps {
  worldState: WorldState;
}

export function CostDashboard({ worldState }: CostDashboardProps) {
  const { totalPromptTokens, totalCompletionTokens, totalCostUsd } = worldState.tokenUsage;
  const agents = Array.from(worldState.agents.values());

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
        Cost Overview
      </h3>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">Total Cost</div>
          <div className="text-lg font-mono font-bold text-emerald-600">
            ${totalCostUsd.toFixed(4)}
          </div>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">Prompt Tokens</div>
          <div className="text-lg font-mono font-bold text-blue-600">
            {totalPromptTokens.toLocaleString()}
          </div>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">Completion Tokens</div>
          <div className="text-lg font-mono font-bold text-purple-600">
            {totalCompletionTokens.toLocaleString()}
          </div>
        </div>
      </div>

      {agents.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-slate-400 font-semibold">Per Agent</div>
          {agents.map((agent) => {
            const total = agent.tokenUsage.promptTokens + agent.tokenUsage.completionTokens;
            const globalTotal = totalPromptTokens + totalCompletionTokens;
            const pct = globalTotal > 0 ? (total / globalTotal) * 100 : 0;

            return (
              <div key={agent.id} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-24 truncate">{agent.name}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-slate-400 w-16 text-right">
                  {total.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
