'use client';

import { useEffect, useRef } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { api } from '@/lib/api-client';

export function SessionList() {
  const { sessions, setSessions, activeSessionId, selectSession } = useSessionStore();
  const prevCountRef = useRef(0);
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fetchSessions = () => {
      api.getSessions().then((data) => {
        const prevCount = prevCountRef.current;
        setSessions(data);
        prevCountRef.current = data.length;

        if (!activeSessionId && data.length > 0) {
          const active = data.find((s) => !s.ended_at) ?? data[0];
          selectSession(active.id);
        }

        if (prevCount > 0 && data.length > prevCount) {
          const newest = data[0];
          if (newest && !notifiedRef.current.has(newest.id)) {
            notifiedRef.current.add(newest.id);
            selectSession(newest.id);
          }
        }
      }).catch((err) => console.warn('AMC: session fetch failed', err.message));
    };
    fetchSessions();
    const interval = setInterval(fetchSessions, 1500);
    return () => clearInterval(interval);
  }, [setSessions, activeSessionId, selectSession]);

  function parseMetadata(raw: unknown): Record<string, unknown> | null {
    if (!raw) return null;
    if (typeof raw === 'string') try { return JSON.parse(raw); } catch { return null; }
    if (typeof raw === 'object') return raw as Record<string, unknown>;
    return null;
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <h2 className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200">
        Sessions
      </h2>
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="p-4 text-sm text-slate-400">No sessions yet</div>
        ) : (
          sessions.map((session) => {
            const isActive = activeSessionId === session.id;
            const isLive = !session.ended_at;
            const meta = parseMetadata(session.metadata);
            const source = meta?.source as string | undefined;
            const cwd = meta?.cwd as string | undefined;
            const projectName = cwd?.split(/[/\\]/).pop() ?? source ?? '';
            const isSim = session.id.startsWith('sim-') || source === 'simulation';

            return (
              <button
                key={session.id}
                onClick={() => selectSession(session.id)}
                className={`
                  w-full text-left px-4 py-3 border-b border-slate-100 transition-colors
                  ${isActive
                    ? 'bg-blue-50 border-l-2 border-l-amc-accent'
                    : 'hover:bg-slate-100'}
                `}
              >
                <div className="flex items-center gap-2">
                  {isLive && (
                    <span className="relative flex h-2 w-2 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                    </span>
                  )}
                  {!isLive && (
                    <span className="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0" />
                  )}
                  <span className="text-sm font-medium text-slate-700 truncate">
                    {isSim ? `Simulation` : projectName || session.id.slice(0, 12)}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                  <span>{new Date(session.started_at).toLocaleTimeString()}</span>
                  {isLive ? (
                    <span className="text-green-600 font-medium">LIVE</span>
                  ) : (
                    <span className="text-slate-400">(ended)</span>
                  )}
                </div>
                {projectName && (
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate font-mono">
                    {cwd ? cwd.replace(/\\/g, '/').slice(-40) : ''}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
