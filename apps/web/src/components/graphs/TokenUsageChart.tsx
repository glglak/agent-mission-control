'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { WorldState } from '@amc/simulation-engine';

interface TokenUsageChartProps {
  worldState: WorldState;
}

export function TokenUsageChart({ worldState }: TokenUsageChartProps) {
  const agents = Array.from(worldState.agents.values());
  const { totalPromptTokens, totalCompletionTokens } = worldState.tokenUsage;

  const data = agents.map((a) => ({
    name: a.name.slice(0, 12),
    prompt: a.tokenUsage.promptTokens,
    completion: a.tokenUsage.completionTokens,
  }));

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
          Token Usage
        </h3>
        <div className="text-xs text-slate-400 font-mono">
          Total: {(totalPromptTokens + totalCompletionTokens).toLocaleString()}
        </div>
      </div>

      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data}>
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                color: '#0f172a',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.07)',
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="prompt"
              stackId="1"
              stroke="#2563eb"
              fill="#2563eb"
              fillOpacity={0.15}
            />
            <Area
              type="monotone"
              dataKey="completion"
              stackId="1"
              stroke="#7c3aed"
              fill="#7c3aed"
              fillOpacity={0.15}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
          No token data yet
        </div>
      )}
    </div>
  );
}
