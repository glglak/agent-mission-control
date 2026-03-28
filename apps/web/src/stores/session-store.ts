import { create } from 'zustand';
import type { CanonicalEvent } from '@amc/shared';
import type { SessionSummary, AgentSummary } from '@/lib/api-client';

interface SessionState {
  // Connection
  connected: boolean;
  setConnected: (v: boolean) => void;

  // Sessions
  sessions: SessionSummary[];
  setSessions: (sessions: SessionSummary[]) => void;
  activeSessionId: string | null;
  selectSession: (id: string | null) => void;

  // Agents
  agents: AgentSummary[];
  setAgents: (agents: AgentSummary[]) => void;

  // Events
  events: CanonicalEvent[];
  addEvent: (event: CanonicalEvent) => void;
  loadEvents: (events: CanonicalEvent[]) => void;
  clearEvents: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  connected: false,
  setConnected: (connected) => set({ connected }),

  sessions: [],
  setSessions: (sessions) => set({ sessions }),
  activeSessionId: null,
  selectSession: (activeSessionId) => set({ activeSessionId, events: [], agents: [] }),

  agents: [],
  setAgents: (agents) => set({ agents }),

  events: [],
  addEvent: (event) =>
    set((state) => {
      if (event.event_id && state.events.some((e) => e.event_id === event.event_id)) {
        return state;
      }
      return { events: [...state.events.slice(-999), event] };
    }),
  loadEvents: (events) => set({ events }),
  clearEvents: () => set({ events: [] }),
}));
