'use client';

import { useMemo, useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import type { CanonicalEvent } from '@amc/shared';

type Tab = 'board' | 'log' | 'retro' | 'metrics';

function pl(ev: CanonicalEvent): Record<string, unknown> {
  return (ev.payload ?? {}) as Record<string, unknown>;
}

interface AgentTask {
  agentId: string;
  agentName: string;
  status: 'working' | 'idle' | 'done' | 'blocked';
  toolCalls: number;
  filesEdited: string[];
  lastActivity: string;
  messages: string[];
}

export function ScrumPanel() {
  const events = useSessionStore(s => s.events);
  const [tab, setTab] = useState<Tab>('board');
  const [humanDismissed, setHumanDismissed] = useState(false);

  const data = useMemo(() => {
    const agents = new Map<string, AgentTask>();
    let sprintGoal = '';
    const messages: { time: string; agent: string; text: string; type: string }[] = [];
    const retros: string[] = [];
    const blockers: string[] = [];
    let recentBlocker = false;

    // Explicit task tracking (from simulations)
    const explicitTasks = new Map<string, { id: string; title: string; assignee: string; points: number; status: string }>();

    for (const ev of events) {
      const p = pl(ev);
      const aid = ev.agent_id ?? 'system';
      const time = new Date(ev.timestamp).toLocaleTimeString();

      // Track explicit tasks
      if (ev.event_type === 'task_assigned') {
        const id = p.task_id as string ?? '';
        if (!sprintGoal && p.sprint_goal) sprintGoal = p.sprint_goal as string;
        explicitTasks.set(id, {
          id, title: p.description as string ?? '', assignee: p.assigned_to as string ?? aid,
          points: p.story_points as number ?? 0, status: 'in_progress',
        });
      }
      if (ev.event_type === 'task_completed') {
        const id = p.task_id as string ?? '';
        const t = explicitTasks.get(id);
        if (t) t.status = (p.status as string) ?? 'done';
      }

      // Detect sprint goal from agent messages (real sessions)
      if (!sprintGoal && ev.event_type === 'agent_message_sent') {
        const content = (p.content as string) ?? '';
        const goalMatch = content.match(/SPRINT GOAL:\s*(.+)/i);
        if (goalMatch) sprintGoal = goalMatch[1].trim();
      }

      // Detect task assignments from agent messages (real sessions — "ASSIGNED: US1 - title — Npts — to Agent")
      if (ev.event_type === 'agent_message_sent') {
        const content = (p.content as string) ?? '';
        const assignMatch = content.match(/ASSIGNED:\s*(US\d+)\s*[-—]\s*(.+?)(?:\s*[-—]\s*(\d+)\s*(?:story\s*)?points?)?(?:\s*[-—]\s*to\s+(\w+))?$/i);
        if (assignMatch) {
          const id = assignMatch[1];
          const title = assignMatch[2].trim();
          const points = parseInt(assignMatch[3] ?? '0', 10);
          const assignee = assignMatch[4] ?? aid;
          explicitTasks.set(id, { id, title, assignee, points, status: 'in_progress' });
        }
      }

      // Track agents (works for REAL Claude sessions)
      if (ev.event_type === 'agent_registered') {
        const name = (p.name as string) ?? aid;
        agents.set(aid, {
          agentId: aid, agentName: name, status: 'working',
          toolCalls: 0, filesEdited: [], lastActivity: time, messages: [],
        });
      }

      if (ev.event_type === 'tool_called' || ev.event_type === 'tool_result') {
        if (!agents.has(aid) && aid !== 'system') {
          agents.set(aid, { agentId: aid, agentName: aid.replace('agent-', ''), status: 'working', toolCalls: 0, filesEdited: [], lastActivity: time, messages: [] });
        }
        const a = agents.get(aid);
        if (a && ev.event_type === 'tool_called') {
          a.toolCalls++;
          a.lastActivity = time;
          a.status = 'working';
          const fp = p.file_path as string;
          if (fp) {
            const short = fp.split(/[/\\]/).pop() ?? fp;
            if (!a.filesEdited.includes(short)) a.filesEdited.push(short);
          }
        }
      }

      if (ev.event_type === 'agent_idle') {
        const a = agents.get(aid);
        if (a) a.status = 'idle';
      }

      if (ev.event_type === 'agent_completed') {
        const a = agents.get(aid);
        if (a) a.status = p.success === false ? 'blocked' : 'done';
      }

      if (ev.event_type === 'agent_message_sent') {
        const content = p.content as string ?? '';
        const msgType = content.match(/WELL:|IMPROVE:/) ? 'retro'
          : content.match(/blocked|need human|waiting for|permission/i) ? 'blocker'
          : content.match(/sprint|goal|backlog|planning/i) ? 'planning'
          : 'chat';
        messages.push({ time, agent: aid, text: content, type: msgType });
        if (msgType === 'retro') retros.push(`${aid}: ${content}`);
        if (msgType === 'blocker') {
          blockers.push(`${aid}: ${content}`);
          // Only flag as recent if within last 20 events
          const idx = events.indexOf(ev);
          if (idx >= events.length - 20) recentBlocker = true;
        }
        const a = agents.get(aid);
        if (a) a.messages.push(content);
      }

    }

    const agentList = Array.from(agents.values());
    const taskList = Array.from(explicitTasks.values());
    const hasExplicitTasks = taskList.length > 0;
    const doneCount = hasExplicitTasks
      ? taskList.filter(t => t.status === 'done').length
      : agentList.filter(a => a.status === 'done').length;
    const totalCount = hasExplicitTasks ? taskList.length : agentList.length;
    const donePoints = taskList.filter(t => t.status === 'done').reduce((a, t) => a + t.points, 0);
    const totalPoints = taskList.reduce((a, t) => a + t.points, 0);

    return { agents: agentList, tasks: taskList, hasExplicitTasks, sprintGoal, messages, retros, blockers,
      needsHuman: recentBlocker, doneCount, totalCount, donePoints, totalPoints };
  }, [events]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'board', label: 'Board' },
    { id: 'log', label: 'Log' },
    { id: 'retro', label: 'Retro' },
    { id: 'metrics', label: 'Metrics' },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Sprint Goal */}
      {data.sprintGoal && (
        <div className="px-3 py-2 bg-blue-50 border-b border-blue-100">
          <div className="text-[10px] font-bold text-blue-500 uppercase">Sprint Goal</div>
          <div className="text-xs text-blue-800 leading-snug">{data.sprintGoal}</div>
        </div>
      )}

      {/* Progress */}
      {data.totalCount > 0 && (
        <div className="px-3 py-2 border-b border-slate-200">
          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
            <span>{data.doneCount}/{data.totalCount} {data.hasExplicitTasks ? 'stories' : 'agents'} done</span>
            <span>{data.totalPoints > 0 ? `${data.donePoints}/${data.totalPoints} pts` : `${Math.round(data.doneCount/Math.max(1,data.totalCount)*100)}%`}</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${(data.doneCount / Math.max(1, data.totalCount)) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Human input alert — dismissable */}
      {data.needsHuman && !humanDismissed && (
        <div className="px-3 py-2 bg-red-50 border-b border-red-200 flex items-center gap-2">
          <span className="text-red-500 font-bold text-sm animate-pulse">!</span>
          <span className="text-xs text-red-700 font-semibold flex-1">Needs Human Input</span>
          <button onClick={() => setHumanDismissed(true)} className="text-red-400 hover:text-red-600 text-xs font-bold">dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-[11px] font-semibold transition-colors ${
              tab === t.id ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-slate-400 hover:text-slate-600'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'board' && <BoardTab agents={data.agents} tasks={data.tasks} hasExplicit={data.hasExplicitTasks} />}
        {tab === 'log' && <LogTab messages={data.messages} />}
        {tab === 'retro' && <RetroTab retros={data.retros} blockers={data.blockers} />}
        {tab === 'metrics' && <MetricsTab data={data} />}
      </div>
    </div>
  );
}

function BoardTab({ agents, tasks, hasExplicit }: { agents: AgentTask[]; tasks: { id: string; title: string; assignee: string; points: number; status: string }[]; hasExplicit: boolean }) {
  if (hasExplicit) {
    // Simulation mode: show kanban columns
    const cols: { status: string; label: string; color: string }[] = [
      { status: 'in_progress', label: 'IN PROGRESS', color: 'border-l-blue-500' },
      { status: 'review', label: 'REVIEW', color: 'border-l-purple-500' },
      { status: 'done', label: 'DONE', color: 'border-l-green-500' },
    ];
    return (
      <div className="p-2 space-y-3">
        {cols.map(col => {
          const items = tasks.filter(t => t.status === col.status);
          if (!items.length) return null;
          return (
            <div key={col.status}>
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{col.label} ({items.length})</div>
              {items.map(t => (
                <div key={t.id} className={`border-l-2 ${col.color} bg-white rounded px-2 py-1.5 mb-1 shadow-sm`}>
                  <div className="text-[11px] font-medium text-slate-700">{t.title}</div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-slate-400">{t.assignee.replace('agent-', '')}</span>
                    <span className="text-[9px] bg-blue-100 text-blue-600 px-1 rounded font-bold">{t.points}pts</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  // Real session mode: show agent activity cards
  return (
    <div className="p-2 space-y-1.5">
      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Active Agents ({agents.length})</div>
      {agents.length === 0 ? (
        <div className="text-xs text-slate-400 text-center py-4">Waiting for agents...</div>
      ) : agents.map(a => {
        const statusColors = { working: 'border-l-blue-500 bg-blue-50', idle: 'border-l-amber-400 bg-amber-50', done: 'border-l-green-500 bg-green-50', blocked: 'border-l-red-500 bg-red-50' };
        const statusLabels = { working: 'Working', idle: 'Idle', done: 'Done', blocked: 'Blocked' };
        return (
          <div key={a.agentId} className={`border-l-2 ${statusColors[a.status]} rounded px-2 py-1.5 shadow-sm`}>
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-700">{a.agentName}</span>
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                a.status === 'working' ? 'bg-blue-100 text-blue-700'
                : a.status === 'blocked' ? 'bg-red-100 text-red-700'
                : a.status === 'done' ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
              }`}>{statusLabels[a.status]}</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {a.toolCalls} calls | {a.filesEdited.length} files | last: {a.lastActivity}
            </div>
            {a.filesEdited.length > 0 && (
              <div className="text-[9px] text-slate-400 mt-0.5 truncate">
                Files: {a.filesEdited.slice(-4).join(', ')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LogTab({ messages }: { messages: { time: string; agent: string; text: string; type: string }[] }) {
  const typeColors: Record<string, string> = { retro: 'text-purple-600', blocker: 'text-red-600', planning: 'text-blue-600', chat: 'text-slate-600' };
  const typeIcons: Record<string, string> = { retro: '🔄', blocker: '🚫', planning: '📋', chat: '💬' };

  return (
    <div className="p-2 space-y-1">
      {messages.length === 0 ? (
        <div className="text-xs text-slate-400 text-center py-4">No messages yet</div>
      ) : messages.map((m, i) => (
        <div key={i} className="flex gap-1.5 text-[11px] py-1 border-b border-slate-100">
          <span className="flex-shrink-0">{typeIcons[m.type] ?? '📋'}</span>
          <div className="min-w-0">
            <div className="flex gap-2 items-baseline">
              <span className="font-bold text-slate-700 text-[10px]">{m.agent.replace('agent-', '')}</span>
              <span className="text-[9px] text-slate-400">{m.time}</span>
            </div>
            <div className={`${typeColors[m.type] ?? 'text-slate-600'} leading-snug break-words`}>{m.text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RetroTab({ retros, blockers }: { retros: string[]; blockers: string[] }) {
  return (
    <div className="p-2 space-y-3">
      <div>
        <div className="text-[10px] font-bold text-red-500 uppercase mb-1">Blockers ({blockers.length})</div>
        {blockers.length === 0 ? (
          <div className="text-[10px] text-slate-400 italic">No blockers</div>
        ) : blockers.map((b, i) => (
          <div key={i} className="text-[11px] text-red-700 bg-red-50 rounded px-2 py-1 mb-1 break-words">{b.replace(/agent-/g, '')}</div>
        ))}
      </div>
      <div>
        <div className="text-[10px] font-bold text-purple-500 uppercase mb-1">Retro Actions ({retros.length})</div>
        {retros.length === 0 ? (
          <div className="text-[10px] text-slate-400 italic">No retro items yet</div>
        ) : retros.map((r, i) => (
          <div key={i} className={`text-[11px] rounded px-2 py-1 mb-1 break-words ${
            r.includes('WELL') ? 'text-green-700 bg-green-50' : 'text-amber-700 bg-amber-50'
          }`}>{r.replace(/agent-/g, '')}</div>
        ))}
      </div>
    </div>
  );
}

function MetricsTab({ data }: { data: { agents: AgentTask[]; doneCount: number; totalCount: number; donePoints: number; totalPoints: number } }) {
  const totalTools = data.agents.reduce((a, ag) => a + ag.toolCalls, 0);
  const totalFiles = new Set(data.agents.flatMap(a => a.filesEdited)).size;

  return (
    <div className="p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <MC label="Agents" value={`${data.agents.length}`} color="text-blue-600" />
        <MC label="Tool Calls" value={`${totalTools}`} color="text-cyan-600" />
        <MC label="Files Touched" value={`${totalFiles}`} color="text-purple-600" />
        {data.totalPoints > 0 && <MC label="Story Points" value={`${data.donePoints}/${data.totalPoints}`} color="text-green-600" />}
        <MC label="Done" value={`${data.doneCount}/${data.totalCount}`} color="text-emerald-600" />
        <MC label="Completion" value={`${data.totalCount > 0 ? Math.round(data.doneCount/data.totalCount*100) : 0}%`} color="text-indigo-600" />
      </div>
    </div>
  );
}

function MC({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-lg p-2 border border-slate-100 shadow-sm">
      <div className="text-[9px] text-slate-400 uppercase font-bold">{label}</div>
      <div className={`text-sm font-bold ${color} mt-0.5`}>{value}</div>
    </div>
  );
}
