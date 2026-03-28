'use client';

import { useMemo } from 'react';
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
  repetitions: Map<string, number>; // tool+file → count (loop detection)
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
  const commPairs = new Map<string, number>(); // "a→b" → count

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
          if (tn === 'Read' || tn === 'Grep' || tn === 'Glob') {
            a.filesRead.add(short);
          }
          // Loop detection
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
      case 'agent_blocked': {
        getAgent(aid).blockedCount++;
        break;
      }
      case 'agent_idle': {
        getAgent(aid).idleCount++;
        break;
      }
    }
  }

  // Compute derived metrics
  for (const a of agents.values()) {
    const totalReads = a.filesRead.size;
    const totalEdits = a.filesEdited.size;
    a.readBeforeEditRatio = totalEdits > 0 ? totalReads / totalEdits : 0;
  }

  // Detect anomalies
  const anomalies: Anomaly[] = [];
  for (const a of agents.values()) {
    // Loop detection: same tool+file > 5 times
    for (const [key, count] of a.repetitions) {
      if (count >= 5) {
        anomalies.push({
          agentId: a.id, agentName: a.name, type: 'loop', severity: 'warning',
          description: `Repeated ${key} ${count} times — possible stuck loop`,
        });
      }
    }
    // High failure rate
    const total = a.toolSuccess + a.toolFail;
    if (total >= 5 && a.toolFail / total > 0.3) {
      anomalies.push({
        agentId: a.id, agentName: a.name, type: 'high_failure', severity: 'warning',
        description: `${Math.round(a.toolFail / total * 100)}% tool failure rate (${a.toolFail}/${total})`,
      });
    }
    // No communication (has tool calls but never sent messages, and other agents exist)
    if (a.toolCalls > 10 && a.messagesSent === 0 && agents.size > 1) {
      anomalies.push({
        agentId: a.id, agentName: a.name, type: 'no_communication', severity: 'info',
        description: `${a.toolCalls} tool calls but no messages sent to other agents`,
      });
    }
    // Over-reading: reads >> edits
    if (a.filesRead.size > 10 && a.filesEdited.size === 0) {
      anomalies.push({
        agentId: a.id, agentName: a.name, type: 'over_reading', severity: 'info',
        description: `Read ${a.filesRead.size} files but edited none — exploratory or stuck?`,
      });
    }
  }

  // Top file hotspots
  const hotspots = Array.from(fileHotspots.entries())
    .sort((a, b) => b[1].edits - a[1].edits)
    .slice(0, 8);

  // Top communication pairs
  const topComms = Array.from(commPairs.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return { agents: Array.from(agents.values()), anomalies, hotspots, topComms };
}

export function BehaviorInsights() {
  const events = useSessionStore(s => s.events);

  const { agents, anomalies, hotspots, topComms } = useMemo(() => analyzeEvents(events), [events]);

  if (agents.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 text-center">
        <div className="text-slate-400 text-sm">No agent activity to analyze yet</div>
      </div>
    );
  }

  const totalTools = agents.reduce((s, a) => s + a.toolCalls, 0);
  const totalFails = agents.reduce((s, a) => s + a.toolFail, 0);
  const totalMessages = agents.reduce((s, a) => s + a.messagesSent, 0);
  const totalFiles = new Set(agents.flatMap(a => [...a.filesEdited])).size;

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
        Behavior Insights
      </h3>

      {/* Overview stats */}
      <div className="grid grid-cols-4 gap-2">
        <Stat label="Tool Calls" value={totalTools} color="text-blue-600" />
        <Stat label="Success Rate" value={`${totalTools > 0 ? Math.round((1 - totalFails / totalTools) * 100) : 0}%`} color={totalFails / Math.max(totalTools, 1) > 0.2 ? 'text-red-600' : 'text-green-600'} />
        <Stat label="Messages" value={totalMessages} color="text-purple-600" />
        <Stat label="Files Touched" value={totalFiles} color="text-amber-600" />
      </div>

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-red-500 uppercase mb-1">Anomalies Detected</div>
          <div className="space-y-1">
            {anomalies.map((a, i) => (
              <div key={i} className={`text-[11px] rounded px-2 py-1.5 flex items-start gap-2 ${
                a.severity === 'warning' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
              }`}>
                <span className="flex-shrink-0">{a.severity === 'warning' ? '!' : 'i'}</span>
                <div>
                  <span className="font-semibold">{a.agentName}:</span> {a.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-agent breakdown */}
      <div>
        <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Agent Profiles</div>
        <div className="space-y-2">
          {agents.sort((a, b) => b.toolCalls - a.toolCalls).map(a => {
            const total = a.toolSuccess + a.toolFail;
            const successRate = total > 0 ? Math.round(a.toolSuccess / total * 100) : 100;
            const topTools = Array.from(a.toolBreakdown.entries())
              .sort((x, y) => y[1] - x[1])
              .slice(0, 3);
            const activeTime = a.lastEvent > a.firstEvent ? Math.round((a.lastEvent - a.firstEvent) / 1000) : 0;

            return (
              <div key={a.id} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-700">{a.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{activeTime > 0 ? `${activeTime}s active` : ''}</span>
                </div>
                <div className="grid grid-cols-4 gap-1 text-[10px] text-slate-500 mb-1.5">
                  <span>{a.toolCalls} calls</span>
                  <span className={successRate < 80 ? 'text-red-500 font-semibold' : ''}>{successRate}% ok</span>
                  <span>{a.filesEdited.size} edits</span>
                  <span>{a.messagesSent} msgs</span>
                </div>
                {/* Tool breakdown bar */}
                {topTools.length > 0 && (
                  <div className="flex h-2 rounded-full overflow-hidden bg-slate-200">
                    {topTools.map(([name, count], i) => {
                      const pct = a.toolCalls > 0 ? (count / a.toolCalls) * 100 : 0;
                      const colors = ['bg-blue-500', 'bg-purple-500', 'bg-cyan-500'];
                      return (
                        <div key={name} className={`${colors[i % 3]} transition-all`}
                          style={{ width: `${pct}%` }}
                          title={`${name}: ${count} (${Math.round(pct)}%)`} />
                      );
                    })}
                  </div>
                )}
                {topTools.length > 0 && (
                  <div className="flex gap-2 mt-1">
                    {topTools.map(([name, count], i) => {
                      const colors = ['text-blue-600', 'text-purple-600', 'text-cyan-600'];
                      return (
                        <span key={name} className={`text-[9px] ${colors[i % 3]} font-mono`}>
                          {name}: {count}
                        </span>
                      );
                    })}
                  </div>
                )}
                {/* Behavior indicators */}
                <div className="flex gap-1 mt-1.5">
                  {a.blockedCount > 0 && <Badge text={`Blocked ${a.blockedCount}x`} color="bg-red-100 text-red-600" />}
                  {a.readBeforeEditRatio > 2 && <Badge text="Careful reader" color="bg-blue-100 text-blue-600" />}
                  {a.readBeforeEditRatio === 0 && a.filesEdited.size > 0 && <Badge text="Edits without reading" color="bg-amber-100 text-amber-600" />}
                  {a.uniqueContacts.size >= 3 && <Badge text="Collaborator" color="bg-green-100 text-green-600" />}
                  {a.messagesSent === 0 && a.toolCalls > 5 && <Badge text="Solo worker" color="bg-slate-200 text-slate-500" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* File hotspots */}
      {hotspots.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase mb-1">File Hotspots</div>
          <div className="space-y-1">
            {hotspots.map(([file, data]) => (
              <div key={file} className="flex items-center gap-2 text-[11px]">
                <div className="flex-1 flex items-center gap-1.5">
                  <span className="font-mono text-slate-600 truncate">{file}</span>
                  {data.agents.size > 1 && (
                    <span className="text-[9px] bg-orange-100 text-orange-600 px-1 rounded font-semibold flex-shrink-0">
                      {data.agents.size} agents
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full"
                      style={{ width: `${Math.min(100, (data.edits / Math.max(...hotspots.map(h => h[1].edits))) * 100)}%` }} />
                  </div>
                  <span className="text-slate-400 font-mono w-6 text-right">{data.edits}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Communication flow */}
      {topComms.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Communication Flow</div>
          <div className="space-y-1">
            {topComms.map(([pair, count]) => {
              const [from, to] = pair.split('→');
              const fromAgent = agents.find(a => a.id === from);
              const toAgent = agents.find(a => a.id === to);
              return (
                <div key={pair} className="flex items-center gap-1 text-[11px]">
                  <span className="font-semibold text-blue-600 truncate">{fromAgent?.name ?? from.slice(0, 8)}</span>
                  <span className="text-slate-300">→</span>
                  <span className="font-semibold text-purple-600 truncate">{toAgent?.name ?? to.slice(0, 8)}</span>
                  <span className="ml-auto text-slate-400 font-mono">{count}x</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-2 text-center">
      <div className="text-[9px] text-slate-400 uppercase font-bold">{label}</div>
      <div className={`text-sm font-bold ${color}`}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${color}`}>{text}</span>
  );
}
