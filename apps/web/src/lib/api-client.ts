const BASE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL ?? 'http://localhost:4700';

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export interface SessionSummary {
  id: string;
  started_at: string;
  ended_at: string | null;
  metadata: Record<string, unknown> | null;
}

export interface AgentSummary {
  id: string;
  session_id: string;
  name: string;
  type: string | null;
  registered_at: string;
  status: string;
}

export const api = {
  getSessions: () => fetchJSON<SessionSummary[]>('/api/sessions'),
  getSession: (id: string) => fetchJSON<SessionSummary>(`/api/sessions/${id}`),
  getAgents: (sessionId: string) => fetchJSON<AgentSummary[]>(`/api/agents?session_id=${sessionId}`),
  getEvents: (params: { session_id?: string; type?: string; from?: string; to?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params.session_id) qs.set('session_id', params.session_id);
    if (params.type) qs.set('type', params.type);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.limit) qs.set('limit', String(params.limit));
    return fetchJSON<unknown[]>(`/api/events?${qs.toString()}`);
  },
  getHealth: () => fetchJSON<{ status: string; uptime: number; event_count: number }>('/api/health'),
};
