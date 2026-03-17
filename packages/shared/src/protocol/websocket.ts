import type { CanonicalEvent } from '../events/types.js';

// Server → Client messages
export type ServerMessage =
  | { type: 'event'; data: CanonicalEvent }
  | { type: 'snapshot'; data: WorldSnapshot }
  | { type: 'error'; message: string };

// Client → Server messages
export type ClientMessage =
  | { type: 'subscribe'; session_id?: string }
  | { type: 'unsubscribe' }
  | { type: 'replay'; session_id: string; from?: string; to?: string };

export interface WorldSnapshot {
  session_id: string;
  agents: AgentSnapshot[];
  recent_events: CanonicalEvent[];
  token_usage: TokenUsageSummary;
}

export interface AgentSnapshot {
  agent_id: string;
  name: string;
  status: string;
  current_task?: string;
  token_usage: { prompt_tokens: number; completion_tokens: number };
}

export interface TokenUsageSummary {
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_cost_usd: number;
}
