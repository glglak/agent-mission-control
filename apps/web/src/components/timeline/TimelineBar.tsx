'use client';

import { useSessionStore } from '@/stores/session-store';
import { EventType } from '@amc/shared';

const eventDotColors: Partial<Record<EventType, string>> = {
  [EventType.AgentRegistered]: '#2563eb',
  [EventType.AgentBlocked]: '#dc2626',
  [EventType.ToolCalled]: '#d97706',
  [EventType.FileEdited]: '#ea580c',
  [EventType.AgentMessageSent]: '#059669',
  [EventType.TokenUsageUpdated]: '#7c3aed',
};

export function TimelineBar() {
  const events = useSessionStore((s) => s.events);

  if (events.length < 2) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-3">
        <div className="text-xs text-slate-400 text-center">
          Timeline will appear as events arrive
        </div>
      </div>
    );
  }

  const firstTs = new Date(events[0].timestamp).getTime();
  const lastTs = new Date(events[events.length - 1].timestamp).getTime();
  const duration = Math.max(lastTs - firstTs, 1);

  return (
    <div className="bg-white rounded-lg shadow-sm p-3">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Timeline
        </h3>
        <span className="text-xs text-slate-400 font-mono ml-auto">
          {(duration / 1000).toFixed(1)}s
        </span>
      </div>
      <div className="relative h-6 bg-slate-100 rounded-full overflow-hidden">
        {events.map((event) => {
          const ts = new Date(event.timestamp).getTime();
          const pct = ((ts - firstTs) / duration) * 100;
          const color = eventDotColors[event.event_type as EventType] ?? '#94a3b8';

          return (
            <div
              key={event.event_id}
              className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
              style={{
                left: `${pct}%`,
                backgroundColor: color,
                boxShadow: `0 0 3px ${color}`,
              }}
              title={`${event.event_type} @ ${new Date(event.timestamp).toLocaleTimeString()}`}
            />
          );
        })}
      </div>
    </div>
  );
}
