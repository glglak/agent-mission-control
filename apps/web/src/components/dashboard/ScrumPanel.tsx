'use client';

import { useMemo } from 'react';
import { useSessionStore } from '@/stores/session-store';
import type { CanonicalEvent } from '@amc/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SprintColumn = 'BACKLOG' | 'IN PROGRESS' | 'REVIEW' | 'DONE';

interface SprintTask {
  task_id: string;
  description: string;
  assigned_to: string;
  story_points: number;
  column: SprintColumn;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HUMAN_KEYWORDS = ['blocked', 'need human', 'waiting for approval', 'permission'] as const;

const CEREMONY_KEYWORDS = [
  'planning',
  'standup',
  'retro',
  'review',
  'blocked',
  'need human',
  'waiting for approval',
] as const;

function payloadField<T>(event: CanonicalEvent, key: string): T | undefined {
  const p = event.payload as Record<string, unknown> | undefined;
  return p?.[key] as T | undefined;
}

function contentMatchesAny(content: string, keywords: readonly string[]): boolean {
  const lower = content.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '\u2026' : text;
}

// ---------------------------------------------------------------------------
// Data derivation
// ---------------------------------------------------------------------------

function deriveSprintData(events: CanonicalEvent[]) {
  const taskMap = new Map<string, SprintTask>();
  let sprintGoal: string | null = null;
  let needsHumanInput = false;
  const ceremonyMessages: string[] = [];

  for (const ev of events) {
    // -- task_assigned -------------------------------------------------------
    if (ev.event_type === 'task_assigned') {
      const taskId = payloadField<string>(ev, 'task_id') ?? '';
      const description = payloadField<string>(ev, 'description') ?? '';
      const assignedTo = payloadField<string>(ev, 'assigned_to') ?? '';
      const storyPoints = payloadField<number>(ev, 'story_points') ?? 0;
      const goal = payloadField<string>(ev, 'sprint_goal');

      if (!sprintGoal && goal) {
        sprintGoal = goal;
      }

      taskMap.set(taskId, {
        task_id: taskId,
        description,
        assigned_to: assignedTo,
        story_points: storyPoints,
        column: 'BACKLOG',
      });
    }

    // -- task_completed ------------------------------------------------------
    if (ev.event_type === 'task_completed') {
      const taskId = payloadField<string>(ev, 'task_id') ?? '';
      const success = payloadField<boolean>(ev, 'success');
      const task = taskMap.get(taskId);
      if (task) {
        task.column = success === false ? 'REVIEW' : 'DONE';
      }
    }

    // -- agent_message_sent --------------------------------------------------
    if (ev.event_type === 'agent_message_sent') {
      const content = payloadField<string>(ev, 'content') ?? '';
      if (contentMatchesAny(content, CEREMONY_KEYWORDS)) {
        ceremonyMessages.push(content);
      }
      if (contentMatchesAny(content, HUMAN_KEYWORDS)) {
        needsHumanInput = true;
      }
    }
  }

  // Infer IN PROGRESS: tasks that are assigned but not yet completed, if there
  // is any later activity by the same agent we consider them in progress.
  const agentActivity = new Set<string>();
  for (const ev of events) {
    if (
      ev.event_type === 'tool_called' ||
      ev.event_type === 'file_edited' ||
      ev.event_type === 'agent_started'
    ) {
      if (ev.agent_id) agentActivity.add(ev.agent_id);
    }
  }

  for (const task of taskMap.values()) {
    if (task.column === 'BACKLOG' && agentActivity.has(task.assigned_to)) {
      task.column = 'IN PROGRESS';
    }
  }

  const tasks = Array.from(taskMap.values());
  const totalPoints = tasks.reduce((s, t) => s + t.story_points, 0);
  const donePoints = tasks
    .filter((t) => t.column === 'DONE')
    .reduce((s, t) => s + t.story_points, 0);

  return { sprintGoal, tasks, totalPoints, donePoints, needsHumanInput, ceremonyMessages };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const COLUMN_ORDER: SprintColumn[] = ['BACKLOG', 'IN PROGRESS', 'REVIEW', 'DONE'];

const COLUMN_COLORS: Record<SprintColumn, string> = {
  BACKLOG: 'border-slate-600',
  'IN PROGRESS': 'border-blue-500',
  REVIEW: 'border-amber-500',
  DONE: 'border-emerald-500',
};

const COLUMN_BADGE_COLORS: Record<SprintColumn, string> = {
  BACKLOG: 'bg-slate-700 text-slate-300',
  'IN PROGRESS': 'bg-blue-900/60 text-blue-300',
  REVIEW: 'bg-amber-900/60 text-amber-300',
  DONE: 'bg-emerald-900/60 text-emerald-300',
};

function TaskCard({ task }: { task: SprintTask }) {
  return (
    <div
      className={`rounded border-l-2 ${COLUMN_COLORS[task.column]} bg-slate-800/80 px-2 py-1.5 mb-1.5 text-xs`}
    >
      <p className="text-slate-200 font-medium leading-tight">
        {truncate(task.description, 38)}
      </p>
      <div className="flex items-center justify-between mt-1">
        <span className="text-slate-400 truncate max-w-[120px]">{task.assigned_to}</span>
        {task.story_points > 0 && (
          <span className="ml-1 shrink-0 rounded-full bg-slate-700 text-slate-300 px-1.5 py-0.5 text-[10px] font-mono font-semibold leading-none">
            {task.story_points}
          </span>
        )}
      </div>
    </div>
  );
}

function ColumnSection({ column, tasks }: { column: SprintColumn; tasks: SprintTask[] }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${COLUMN_BADGE_COLORS[column]}`}
        >
          {column}
        </span>
        <span className="text-[10px] text-slate-500 font-mono">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="text-[10px] text-slate-600 italic pl-1">No tasks</p>
      ) : (
        tasks.map((t) => <TaskCard key={t.task_id} task={t} />)
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ScrumPanel() {
  const events = useSessionStore((s) => s.events);

  const { sprintGoal, tasks, totalPoints, donePoints, needsHumanInput } = useMemo(
    () => deriveSprintData(events),
    [events],
  );

  const doneTasks = tasks.filter((t) => t.column === 'DONE').length;
  const totalTasks = tasks.length;
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="w-[280px] max-h-full flex flex-col bg-slate-900 text-slate-100 rounded-lg border border-slate-700/60 overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-slate-700/60">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
          Sprint Board
        </h2>

        {sprintGoal && (
          <p className="text-[11px] text-slate-300 leading-snug mb-2">
            {truncate(sprintGoal, 60)}
          </p>
        )}

        {/* Progress bar */}
        <div className="mb-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
            <span>
              {doneTasks}/{totalTasks} tasks
            </span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Story points */}
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>Story points</span>
          <span className="font-mono">
            <span className="text-emerald-400">{donePoints}</span>
            <span className="text-slate-600 mx-0.5">/</span>
            <span>{totalPoints}</span>
          </span>
        </div>

        {/* Human input indicator */}
        {needsHumanInput && (
          <div className="mt-2 flex items-center gap-1.5 rounded bg-red-900/50 border border-red-700/60 px-2 py-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-300">
              Needs Human Input
            </span>
          </div>
        )}
      </div>

      {/* Board columns (vertical, scrollable) */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0">
        {totalTasks === 0 ? (
          <p className="text-xs text-slate-500 italic text-center py-6">
            No sprint tasks detected yet.
          </p>
        ) : (
          COLUMN_ORDER.map((col) => (
            <ColumnSection
              key={col}
              column={col}
              tasks={tasks.filter((t) => t.column === col)}
            />
          ))
        )}
      </div>
    </div>
  );
}
