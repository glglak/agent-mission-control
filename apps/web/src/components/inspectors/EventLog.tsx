'use client';

import { useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { EventType } from '@amc/shared';

const eventTypeColors: Partial<Record<EventType, string>> = {
  [EventType.AgentRegistered]: 'text-blue-600',
  [EventType.AgentStarted]: 'text-emerald-600',
  [EventType.AgentBlocked]: 'text-red-600',
  [EventType.AgentCompleted]: 'text-slate-500',
  [EventType.ToolCalled]: 'text-amber-600',
  [EventType.ToolResult]: 'text-amber-500',
  [EventType.FileEdited]: 'text-orange-600',
  [EventType.TokenUsageUpdated]: 'text-purple-600',
  [EventType.AgentMessageSent]: 'text-emerald-500',
};

export function EventLog() {
  const events = useSessionStore((s) => s.events);
  const [filter, setFilter] = useState<string>('');

  const filtered = filter
    ? events.filter((e) => e.event_type.includes(filter))
    : events;

  const displayed = filtered.slice(-100).reverse();

  return (
    <div className="bg-white rounded-lg shadow-sm flex flex-col" style={{ height: 300 }}>
      <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
          Event Log
        </h3>
        <input
          type="text"
          placeholder="Filter events..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 placeholder-slate-400 w-40 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-colors"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {displayed.map((event) => (
          <div
            key={event.event_id}
            className="text-xs px-2 py-1.5 rounded flex items-center gap-2 hover:bg-slate-50 transition-colors"
          >
            <span className="text-slate-400 font-mono w-20 flex-shrink-0">
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
            <span
              className={`font-mono flex-shrink-0 ${eventTypeColors[event.event_type as EventType] ?? 'text-slate-500'}`}
            >
              {event.event_type}
            </span>
            {event.agent_id && (
              <span className="text-slate-400 truncate">
                [{event.agent_id.slice(0, 8)}]
              </span>
            )}
          </div>
        ))}
        {displayed.length === 0 && (
          <div className="text-slate-400 text-xs text-center py-4">
            {filter ? 'No matching events' : 'No events yet'}
          </div>
        )}
      </div>
    </div>
  );
}
