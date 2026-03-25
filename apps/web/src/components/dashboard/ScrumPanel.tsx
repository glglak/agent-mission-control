'use client';

import { useMemo, useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import type { CanonicalEvent } from '@amc/shared';

type Tab = 'board' | 'log' | 'retro' | 'metrics';

function pl(ev: CanonicalEvent): Record<string, unknown> {
  return (ev.payload ?? {}) as Record<string, unknown>;
}

interface Task {
  id: string;
  title: string;
  assignee: string;
  points: number;
  status: 'backlog' | 'in_progress' | 'review' | 'done';
}

export function ScrumPanel() {
  const events = useSessionStore(s => s.events);
  const [tab, setTab] = useState<Tab>('board');

  const data = useMemo(() => {
    const tasks = new Map<string, Task>();
    let sprintGoal = '';
    const messages: { time: string; agent: string; text: string; type: string }[] = [];
    const retros: string[] = [];
    const blockers: string[] = [];
    let totalTokens = 0;
    let totalCost = 0;
    let needsHuman = false;

    for (const ev of events) {
      const p = pl(ev);
      const agent = ev.agent_id ?? 'system';
      const time = new Date(ev.timestamp).toLocaleTimeString();

      if (ev.event_type === 'task_assigned') {
        const id = p.task_id as string ?? '';
        if (!sprintGoal && p.sprint_goal) sprintGoal = p.sprint_goal as string;
        tasks.set(id, {
          id,
          title: p.description as string ?? '',
          assignee: p.assigned_to as string ?? agent,
          points: p.story_points as number ?? 0,
          status: 'in_progress',
        });
      }

      if (ev.event_type === 'task_completed') {
        const id = p.task_id as string ?? '';
        const task = tasks.get(id);
        if (task) {
          task.status = (p.status as string ?? 'done') as Task['status'];
        }
      }

      if (ev.event_type === 'agent_message_sent') {
        const content = p.content as string ?? '';
        const msgType = content.match(/WELL:|IMPROVE:/) ? 'retro'
          : content.match(/blocked|need human|waiting|permission/i) ? 'blocker'
          : content.match(/sprint|goal|backlog|planning/i) ? 'planning'
          : 'chat';

        messages.push({ time, agent, text: content, type: msgType });

        if (msgType === 'retro') retros.push(`${agent}: ${content}`);
        if (msgType === 'blocker') { blockers.push(`${agent}: ${content}`); needsHuman = true; }
      }

      if (ev.event_type === 'token_usage_updated') {
        totalTokens += (p.total_tokens as number) ?? 0;
      }
      if (ev.event_type === 'cost_estimate_updated') {
        totalCost = Math.max(totalCost, (p.cumulative_cost_usd as number) ?? 0);
      }
    }

    const taskList = Array.from(tasks.values());
    const donePoints = taskList.filter(t => t.status === 'done').reduce((a, t) => a + t.points, 0);
    const totalPoints = taskList.reduce((a, t) => a + t.points, 0);

    return { tasks: taskList, sprintGoal, messages, retros, blockers, needsHuman, totalTokens, totalCost, donePoints, totalPoints };
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

      {/* Progress bar */}
      {data.totalPoints > 0 && (
        <div className="px-3 py-2 border-b border-slate-200">
          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
            <span>{data.donePoints}/{data.totalPoints} pts</span>
            <span>{Math.round(data.donePoints / data.totalPoints * 100)}%</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${(data.donePoints / data.totalPoints) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Human input alert */}
      {data.needsHuman && (
        <div className="px-3 py-2 bg-red-50 border-b border-red-200 flex items-center gap-2">
          <span className="text-red-500 font-bold text-sm">!</span>
          <span className="text-xs text-red-700 font-semibold">Needs Human Input</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-[11px] font-semibold transition-colors ${
              tab === t.id ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-slate-400 hover:text-slate-600'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'board' && <BoardTab tasks={data.tasks} />}
        {tab === 'log' && <LogTab messages={data.messages} />}
        {tab === 'retro' && <RetroTab retros={data.retros} blockers={data.blockers} />}
        {tab === 'metrics' && <MetricsTab data={data} />}
      </div>
    </div>
  );
}

function BoardTab({ tasks }: { tasks: Task[] }) {
  const cols: { status: Task['status']; label: string; color: string }[] = [
    { status: 'backlog', label: 'BACKLOG', color: 'border-l-slate-400' },
    { status: 'in_progress', label: 'IN PROGRESS', color: 'border-l-blue-500' },
    { status: 'review', label: 'REVIEW', color: 'border-l-purple-500' },
    { status: 'done', label: 'DONE', color: 'border-l-green-500' },
  ];

  return (
    <div className="p-2 space-y-3">
      {cols.map(col => {
        const items = tasks.filter(t => t.status === col.status);
        return (
          <div key={col.status}>
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex justify-between">
              <span>{col.label}</span>
              <span className="text-slate-300">{items.length}</span>
            </div>
            {items.length === 0 ? (
              <div className="text-[10px] text-slate-300 italic px-2">empty</div>
            ) : items.map(t => (
              <div key={t.id} className={`border-l-2 ${col.color} bg-white rounded px-2 py-1.5 mb-1 shadow-sm`}>
                <div className="text-[11px] font-medium text-slate-700 leading-snug">{t.title}</div>
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

function LogTab({ messages }: { messages: { time: string; agent: string; text: string; type: string }[] }) {
  const typeColors: Record<string, string> = {
    retro: 'text-purple-600', blocker: 'text-red-600', planning: 'text-blue-600', chat: 'text-slate-600',
  };
  const typeIcons: Record<string, string> = {
    retro: '🔄', blocker: '🚫', planning: '📋', chat: '💬',
  };

  return (
    <div className="p-2 space-y-1">
      {messages.length === 0 ? (
        <div className="text-xs text-slate-400 text-center py-4">No messages yet</div>
      ) : messages.map((m, i) => (
        <div key={i} className="flex gap-1.5 text-[11px] py-1 border-b border-slate-100 last:border-0">
          <span className="flex-shrink-0">{typeIcons[m.type] ?? '📋'}</span>
          <div className="min-w-0">
            <div className="flex gap-2 items-baseline">
              <span className="font-bold text-slate-700 text-[10px]">{m.agent.replace('agent-', '')}</span>
              <span className="text-[9px] text-slate-400">{m.time}</span>
            </div>
            <div className={`${typeColors[m.type] ?? 'text-slate-600'} leading-snug`}>{m.text}</div>
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
        <div className="text-[10px] font-bold text-red-500 uppercase mb-1">Blockers</div>
        {blockers.length === 0 ? (
          <div className="text-[10px] text-slate-400 italic">None</div>
        ) : blockers.map((b, i) => (
          <div key={i} className="text-[11px] text-red-700 bg-red-50 rounded px-2 py-1 mb-1">{b.replace('agent-', '')}</div>
        ))}
      </div>
      <div>
        <div className="text-[10px] font-bold text-purple-500 uppercase mb-1">Retro Actions</div>
        {retros.length === 0 ? (
          <div className="text-[10px] text-slate-400 italic">No retro items yet</div>
        ) : retros.map((r, i) => (
          <div key={i} className={`text-[11px] rounded px-2 py-1 mb-1 ${
            r.includes('WELL') ? 'text-green-700 bg-green-50' : 'text-amber-700 bg-amber-50'
          }`}>{r.replace('agent-', '')}</div>
        ))}
      </div>
    </div>
  );
}

function MetricsTab({ data }: { data: { totalTokens: number; totalCost: number; tasks: Task[]; donePoints: number; totalPoints: number } }) {
  const velocity = data.donePoints;
  const burnRate = data.totalPoints > 0 ? Math.round((data.donePoints / data.totalPoints) * 100) : 0;

  return (
    <div className="p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="Velocity" value={`${velocity} pts`} color="text-blue-600" />
        <MetricCard label="Burn Rate" value={`${burnRate}%`} color="text-green-600" />
        <MetricCard label="Total Tokens" value={data.totalTokens.toLocaleString()} color="text-purple-600" />
        <MetricCard label="Cost" value={`$${data.totalCost.toFixed(4)}`} color="text-amber-600" />
        <MetricCard label="Stories Done" value={`${data.tasks.filter(t => t.status === 'done').length}/${data.tasks.length}`} color="text-emerald-600" />
        <MetricCard label="Points Done" value={`${data.donePoints}/${data.totalPoints}`} color="text-cyan-600" />
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-lg p-2 border border-slate-100 shadow-sm">
      <div className="text-[9px] text-slate-400 uppercase font-bold">{label}</div>
      <div className={`text-sm font-bold ${color} mt-0.5`}>{value}</div>
    </div>
  );
}
