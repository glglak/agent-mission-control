'use client';

import { useMemo, useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import type { CanonicalEvent } from '@amc/shared';

function pl(ev: CanonicalEvent): Record<string, unknown> {
  return (ev.payload ?? {}) as Record<string, unknown>;
}

interface AgentProfile {
  id: string;
  name: string;
  toolCalls: number;
  toolSuccess: number;
  toolFail: number;
  filesEdited: Set<string>;
  filesRead: Set<string>;
  messagesSent: number;
  messagesReceived: number;
  blockedCount: number;
  idleCount: number;
  toolBreakdown: Map<string, number>;
  firstEvent: number;
  lastEvent: number;
  readBeforeEditRatio: number;
  uniqueContacts: Set<string>;
  repetitions: Map<string, number>;
}

interface Anomaly {
  agentId: string;
  agentName: string;
  type: 'loop' | 'high_failure' | 'silent' | 'over_reading' | 'no_communication';
  severity: 'warning' | 'info';
  description: string;
}

function analyzeEvents(events: CanonicalEvent[]) {
  const agents = new Map<string, AgentProfile>();
  const fileHotspots = new Map<string, { edits: number; agents: Set<string> }>();
  const commPairs = new Map<string, number>();

  function getAgent(id: string, name?: string): AgentProfile {
    if (!agents.has(id)) {
      agents.set(id, {
        id, name: name ?? id, toolCalls: 0, toolSuccess: 0, toolFail: 0,
        filesEdited: new Set(), filesRead: new Set(), messagesSent: 0, messagesReceived: 0,
        blockedCount: 0, idleCount: 0, toolBreakdown: new Map(),
        firstEvent: Infinity, lastEvent: 0, readBeforeEditRatio: 0,
        uniqueContacts: new Set(), repetitions: new Map(),
      });
    }
    return agents.get(id)!;
  }

  for (const ev of events) {
    const aid = ev.agent_id ?? '';
    if (!aid) continue;
    const p = pl(ev);
    const ts = new Date(ev.timestamp).getTime();

    switch (ev.event_type) {
      case 'agent_registered': {
        const a = getAgent(aid, p.name as string);
        a.name = (p.name as string) ?? aid;
        break;
      }
      case 'tool_called': {
        const a = getAgent(aid);
        a.toolCalls++;
        if (ts < a.firstEvent) a.firstEvent = ts;
        if (ts > a.lastEvent) a.lastEvent = ts;
        const tn = (p.tool_name as string) ?? '';
        a.toolBreakdown.set(tn, (a.toolBreakdown.get(tn) ?? 0) + 1);
        const fp = (p.file_path as string) ?? '';
        if (fp) {
          const short = fp.split(/[/\\]/).pop() ?? fp;
          if (tn === 'Read' || tn === 'Grep' || tn === 'Glob') a.filesRead.add(short);
          const key = `${tn}:${short}`;
          a.repetitions.set(key, (a.repetitions.get(key) ?? 0) + 1);
        }
        break;
      }
      case 'tool_result': {
        const a = getAgent(aid);
        if (p.success === false) a.toolFail++;
        else a.toolSuccess++;
        break;
      }
      case 'file_edited': {
        const fp = (p.file_path as string) ?? '';
        if (!fp) break;
        const short = fp.split(/[/\\]/).pop() ?? fp;
        const a = getAgent(aid);
        a.filesEdited.add(short);
        if (!fileHotspots.has(short)) fileHotspots.set(short, { edits: 0, agents: new Set() });
        const h = fileHotspots.get(short)!;
        h.edits++;
        h.agents.add(aid);
        break;
      }
      case 'agent_message_sent': {
        const a = getAgent(aid);
        a.messagesSent++;
        const toId = (p.to_agent_id as string) ?? '';
        if (toId && toId !== 'user') {
          a.uniqueContacts.add(toId);
          const pair = `${aid}→${toId}`;
          commPairs.set(pair, (commPairs.get(pair) ?? 0) + 1);
          const target = getAgent(toId);
          target.messagesReceived++;
          target.uniqueContacts.add(aid);
        }
        break;
      }
      case 'agent_blocked': { getAgent(aid).blockedCount++; break; }
      case 'agent_idle': { getAgent(aid).idleCount++; break; }
    }
  }

  for (const a of agents.values()) {
    const totalReads = a.filesRead.size;
    const totalEdits = a.filesEdited.size;
    a.readBeforeEditRatio = totalEdits > 0 ? totalReads / totalEdits : 0;
  }

  const anomalies: Anomaly[] = [];
  for (const a of agents.values()) {
    for (const [key, count] of a.repetitions) {
      if (count >= 5) {
        anomalies.push({ agentId: a.id, agentName: a.name, type: 'loop', severity: 'warning',
          description: `Repeated ${key.split(':')[0]} on ${key.split(':')[1]} ${count}x` });
      }
    }
    const total = a.toolSuccess + a.toolFail;
    if (total >= 5 && a.toolFail / total > 0.3) {
      anomalies.push({ agentId: a.id, agentName: a.name, type: 'high_failure', severity: 'warning',
        description: `${Math.round(a.toolFail / total * 100)}% failure rate (${a.toolFail}/${total} calls)` });
    }
    if (a.toolCalls > 10 && a.messagesSent === 0 && agents.size > 1) {
      anomalies.push({ agentId: a.id, agentName: a.name, type: 'no_communication', severity: 'info',
        description: `${a.toolCalls} calls, 0 messages — working solo` });
    }
    if (a.filesRead.size > 10 && a.filesEdited.size === 0) {
      anomalies.push({ agentId: a.id, agentName: a.name, type: 'over_reading', severity: 'info',
        description: `Read ${a.filesRead.size} files, edited none` });
    }
  }

  const hotspots = Array.from(fileHotspots.entries()).sort((a, b) => b[1].edits - a[1].edits).slice(0, 6);
  const topComms = Array.from(commPairs.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return { agents: Array.from(agents.values()), anomalies, hotspots, topComms };
}

// === Tool color mapping ===
const TOOL_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  Read: { bg: 'bg-sky-100', text: 'text-sky-700', bar: 'bg-sky-500' },
  Write: { bg: 'bg-emerald-100', text: 'text-emerald-700', bar: 'bg-emerald-500' },
  Edit: { bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500' },
  Bash: { bg: 'bg-amber-100', text: 'text-amber-700', bar: 'bg-amber-500' },
  Grep: { bg: 'bg-violet-100', text: 'text-violet-700', bar: 'bg-violet-500' },
  Glob: { bg: 'bg-purple-100', text: 'text-purple-700', bar: 'bg-purple-500' },
  Agent: { bg: 'bg-pink-100', text: 'text-pink-700', bar: 'bg-pink-500' },
};
const DEFAULT_TOOL_COLOR = { bg: 'bg-slate-100', text: 'text-slate-600', bar: 'bg-slate-400' };

export function BehaviorInsights() {
  const events = useSessionStore(s => s.events);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const { agents, anomalies, hotspots, topComms } = useMemo(() => analyzeEvents(events), [events]);

  if (agents.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <div className="text-slate-300 text-3xl mb-2">~</div>
        <div className="text-slate-400 text-sm">No agent activity to analyze yet</div>
      </div>
    );
  }

  const totalTools = agents.reduce((s, a) => s + a.toolCalls, 0);
  const totalFails = agents.reduce((s, a) => s + a.toolFail, 0);
  const totalMessages = agents.reduce((s, a) => s + a.messagesSent, 0);
  const totalFiles = new Set(agents.flatMap(a => [...a.filesEdited])).size;
  const successRate = totalTools > 0 ? Math.round((1 - totalFails / totalTools) * 100) : 100;

  return (
    <div className="space-y-4">
      {/* Header + KPIs */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Behavior Insights</h3>
          <span className="text-[10px] text-slate-400 font-mono">{events.length} events analyzed</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KPI label="Agents" value={agents.length} icon="A" iconBg="bg-blue-500" />
          <KPI label="Tool Calls" value={totalTools} icon="T" iconBg="bg-cyan-500" />
          <KPI label="Success" value={`${successRate}%`} icon={successRate >= 90 ? '+' : '!'} iconBg={successRate >= 90 ? 'bg-green-500' : 'bg-red-500'} />
          <KPI label="Messages" value={totalMessages} icon="M" iconBg="bg-purple-500" />
          <KPI label="Files" value={totalFiles} icon="F" iconBg="bg-amber-500" />
        </div>
      </div>

      {/* Anomalies banner — only if present */}
      {anomalies.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-xs font-bold text-red-600 uppercase mb-2">
            {anomalies.length} {anomalies.length === 1 ? 'Anomaly' : 'Anomalies'} Detected
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
            {anomalies.map((a, i) => (
              <div key={i} className={`text-[11px] rounded-md px-2.5 py-1.5 flex items-center gap-2 ${
                a.severity === 'warning' ? 'bg-white border border-red-200 text-red-700' : 'bg-white border border-amber-200 text-amber-700'
              }`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ${
                  a.severity === 'warning' ? 'bg-red-500' : 'bg-amber-500'
                }`}>{a.severity === 'warning' ? '!' : 'i'}</span>
                <div className="min-w-0">
                  <span className="font-bold">{a.agentName}</span>
                  <span className="text-slate-400 mx-1">—</span>
                  <span>{a.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two-column layout: Agents left, Hotspots + Comms right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Agent Profiles — 2 columns wide */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase mb-3">Agent Profiles</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {agents.sort((a, b) => b.toolCalls - a.toolCalls).map(a => {
              const total = a.toolSuccess + a.toolFail;
              const sr = total > 0 ? Math.round(a.toolSuccess / total * 100) : 100;
              const topTools = Array.from(a.toolBreakdown.entries()).sort((x, y) => y[1] - x[1]).slice(0, 4);
              const isExpanded = expandedAgent === a.id;
              const activeTime = a.lastEvent > a.firstEvent ? Math.round((a.lastEvent - a.firstEvent) / 1000) : 0;
              const badges = getBadges(a);

              return (
                <div key={a.id}
                  className={`rounded-lg border transition-all cursor-pointer ${
                    isExpanded ? 'border-blue-300 bg-blue-50/30 shadow-md' : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                  }`}
                  onClick={() => setExpandedAgent(isExpanded ? null : a.id)}>
                  {/* Compact header — always visible */}
                  <div className="p-2.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
                        sr >= 90 ? 'bg-green-500' : sr >= 70 ? 'bg-amber-500' : 'bg-red-500'
                      }`}>{sr}%</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-700 truncate">{a.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {a.toolCalls} calls · {a.filesEdited.size} files · {a.messagesSent} msgs
                          {activeTime > 0 && ` · ${activeTime}s`}
                        </div>
                      </div>
                    </div>

                    {/* Tool bar — compact */}
                    {topTools.length > 0 && (
                      <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-200 mb-1.5">
                        {topTools.map(([name, count]) => {
                          const pct = a.toolCalls > 0 ? (count / a.toolCalls) * 100 : 0;
                          const tc = TOOL_COLORS[name] ?? DEFAULT_TOOL_COLOR;
                          return <div key={name} className={`${tc.bar}`} style={{ width: `${pct}%` }} title={`${name}: ${count}`} />;
                        })}
                      </div>
                    )}

                    {/* Badges */}
                    {badges.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {badges.map((b, i) => <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${b.color}`}>{b.text}</span>)}
                      </div>
                    )}
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 p-2.5 space-y-2">
                      {/* Tool breakdown with labels */}
                      <div className="flex flex-wrap gap-1.5">
                        {topTools.map(([name, count]) => {
                          const tc = TOOL_COLORS[name] ?? DEFAULT_TOOL_COLOR;
                          return (
                            <span key={name} className={`text-[10px] ${tc.bg} ${tc.text} px-2 py-0.5 rounded-full font-mono font-semibold`}>
                              {name} {count}
                            </span>
                          );
                        })}
                      </div>
                      {/* Files */}
                      {a.filesEdited.size > 0 && (
                        <div>
                          <div className="text-[9px] text-slate-400 uppercase font-bold mb-0.5">Files Edited</div>
                          <div className="text-[10px] text-slate-500 font-mono leading-relaxed">
                            {[...a.filesEdited].slice(0, 6).join(', ')}{a.filesEdited.size > 6 ? ` +${a.filesEdited.size - 6} more` : ''}
                          </div>
                        </div>
                      )}
                      {/* Stats grid */}
                      <div className="grid grid-cols-3 gap-1 text-center">
                        <MiniStat label="Success" value={`${sr}%`} />
                        <MiniStat label="Blocked" value={a.blockedCount} />
                        <MiniStat label="Contacts" value={a.uniqueContacts.size} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: Hotspots + Communication */}
        <div className="space-y-4">
          {/* File Hotspots */}
          {hotspots.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-xs font-semibold text-slate-400 uppercase mb-2">File Hotspots</div>
              <div className="space-y-1.5">
                {hotspots.map(([file, data]) => {
                  const maxEdits = Math.max(...hotspots.map(h => h[1].edits));
                  return (
                    <div key={file}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] font-mono text-slate-600 truncate flex-1">{file}</span>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                          {data.agents.size > 1 && (
                            <span className="text-[9px] bg-orange-100 text-orange-600 px-1 rounded font-bold">{data.agents.size}x</span>
                          )}
                          <span className="text-[10px] text-slate-400 font-mono w-5 text-right">{data.edits}</span>
                        </div>
                      </div>
                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${data.agents.size > 1 ? 'bg-orange-500' : 'bg-blue-400'}`}
                          style={{ width: `${(data.edits / maxEdits) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Communication Flow */}
          {topComms.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Communication Flow</div>
              <div className="space-y-1.5">
                {topComms.map(([pair, count]) => {
                  const [from, to] = pair.split('→');
                  const fromAgent = agents.find(a => a.id === from);
                  const toAgent = agents.find(a => a.id === to);
                  const maxCount = topComms[0][1];
                  return (
                    <div key={pair}>
                      <div className="flex items-center gap-1.5 text-[11px] mb-0.5">
                        <span className="font-bold text-blue-600 truncate max-w-[80px]">{fromAgent?.name ?? from.slice(0, 8)}</span>
                        <svg width="12" height="8" className="flex-shrink-0 text-slate-300"><path d="M0 4h8m0 0l-3-3m3 3l-3 3" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
                        <span className="font-bold text-purple-600 truncate max-w-[80px]">{toAgent?.name ?? to.slice(0, 8)}</span>
                        <span className="ml-auto text-slate-400 font-mono text-[10px]">{count}</span>
                      </div>
                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-400 to-purple-400 rounded-full"
                          style={{ width: `${(count / maxCount) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getBadges(a: AgentProfile): { text: string; color: string }[] {
  const badges: { text: string; color: string }[] = [];
  if (a.blockedCount > 0) badges.push({ text: `Blocked ${a.blockedCount}x`, color: 'bg-red-100 text-red-600' });
  if (a.readBeforeEditRatio > 2) badges.push({ text: 'Thorough', color: 'bg-blue-100 text-blue-600' });
  if (a.readBeforeEditRatio === 0 && a.filesEdited.size > 0) badges.push({ text: 'Fast mover', color: 'bg-amber-100 text-amber-600' });
  if (a.uniqueContacts.size >= 3) badges.push({ text: 'Collaborator', color: 'bg-green-100 text-green-600' });
  if (a.messagesSent === 0 && a.toolCalls > 5) badges.push({ text: 'Solo', color: 'bg-slate-200 text-slate-500' });
  if (a.toolCalls > 0 && a.toolFail === 0) badges.push({ text: 'Zero errors', color: 'bg-emerald-100 text-emerald-600' });
  return badges;
}

function KPI({ label, value, icon, iconBg }: { label: string; value: string | number; icon: string; iconBg: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>{icon}</div>
      <div>
        <div className={`text-base font-bold text-slate-800`}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
        <div className="text-[10px] text-slate-400 uppercase font-semibold -mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded p-1">
      <div className="text-[10px] font-bold text-slate-700">{value}</div>
      <div className="text-[8px] text-slate-400 uppercase">{label}</div>
    </div>
  );
}
