'use client';

import { useRef, useEffect } from 'react';
import { useSessionStore } from '@/stores/session-store';

export function ActivityFeed() {
  const events = useSessionStore(s => s.events);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  // Build readable feed items from events
  const feedItems = events.slice(-100).map((ev) => {
    const time = new Date(ev.timestamp).toLocaleTimeString();
    const agent = ev.agent_id ?? 'system';
    const payload = ev.payload as Record<string, unknown> | undefined;
    let icon = '📋';
    let text = '';
    let color = 'text-slate-400';

    switch (ev.event_type) {
      case 'session_started':
        icon = '🚀'; text = 'Session started'; color = 'text-green-400'; break;
      case 'session_ended':
        icon = '🏁'; text = 'Session ended'; color = 'text-slate-500'; break;
      case 'agent_registered':
        icon = '👤'; text = `${payload?.name ?? agent} joined the team`; color = 'text-blue-400'; break;
      case 'agent_completed':
        icon = payload?.success === false ? '🔥' : '✅';
        text = payload?.success === false ? `${agent} was fired!` : `${agent} completed`;
        color = payload?.success === false ? 'text-red-400' : 'text-green-400'; break;
      case 'agent_idle':
        icon = '☕'; text = `went idle`; color = 'text-amber-400'; break;
      case 'tool_called': {
        const tool = payload?.tool_name as string ?? '';
        const file = (payload?.file_path as string ?? '').split(/[/\\]/).pop() ?? '';
        icon = tool === 'Bash' ? '⚡' : tool === 'Write' || tool === 'Edit' ? '✏️' : tool === 'Read' ? '📖' : '🔧';
        text = `${tool}${file ? ` → ${file}` : ''}`;
        color = 'text-slate-300'; break;
      }
      case 'agent_message_sent': {
        const content = payload?.content as string ?? '';
        icon = '💬';
        text = content.slice(0, 80);
        color = content.match(/blocked|need human|waiting|permission/i) ? 'text-red-400' : 'text-emerald-400';
        break;
      }
      case 'task_assigned': {
        const desc = payload?.description as string ?? '';
        const pts = payload?.story_points as number ?? 0;
        icon = '📌';
        text = `Assigned: ${desc} (${pts}pts)`;
        color = 'text-blue-300'; break;
      }
      case 'task_completed': {
        const desc = payload?.result as string ?? '';
        icon = '✅';
        text = `Done: ${desc}`;
        color = 'text-green-300'; break;
      }
      case 'token_usage_updated': {
        const total = payload?.total_tokens as number ?? 0;
        icon = '🪙';
        text = `${total.toLocaleString()} tokens (${payload?.model ?? ''})`;
        color = 'text-purple-400'; break;
      }
      default:
        text = ev.event_type; break;
    }

    return { id: ev.event_id, time, agent, icon, text, color };
  });

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-700 flex flex-col" style={{ height: 300 }}>
      <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Activity Feed</h3>
        <span className="text-[10px] text-slate-500 font-mono">{events.length} events</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {feedItems.length === 0 ? (
          <div className="text-slate-600 text-xs text-center py-8">Waiting for events...</div>
        ) : (
          feedItems.map((item) => (
            <div key={item.id} className="flex items-start gap-1.5 text-[11px] py-0.5 hover:bg-slate-800/50 rounded px-1">
              <span className="flex-shrink-0 w-4 text-center">{item.icon}</span>
              <span className="text-slate-600 font-mono flex-shrink-0 w-16">{item.time}</span>
              <span className="text-slate-500 font-semibold flex-shrink-0 w-20 truncate">{item.agent}</span>
              <span className={`${item.color} truncate`}>{item.text}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
