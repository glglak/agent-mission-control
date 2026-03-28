'use client';

import { useMemo } from 'react';
import { useSessionStore } from '@/stores/session-store';

export function StatusBar() {
  const connected = useSessionStore((s) => s.connected);
  const events = useSessionStore((s) => s.events);
  const eventCount = events.length;
  const agentCount = useMemo(() => {
    const ids = new Set<string>();
    for (const e of events) {
      if (e.event_type === 'agent_registered' && e.agent_id) {
        ids.add(e.agent_id);
      }
    }
    return ids.size;
  }, [events]);

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-white shadow-sm text-sm">
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${connected ? 'bg-amc-success' : 'bg-amc-danger'}`}
        />
        <span className="text-slate-500">
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      <div className="text-slate-300">|</div>
      <div className="text-slate-500">
        Agents: <span className="text-slate-800 font-mono font-medium">{agentCount}</span>
      </div>
      <div className="text-slate-300">|</div>
      <div className="text-slate-500">
        Events: <span className="text-slate-800 font-mono font-medium">{eventCount}</span>
      </div>
    </div>
  );
}
