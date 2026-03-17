import type { AgentState } from './agent-state.js';

export interface Connection {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  timestamp: string;
  decay: number;
}

export interface FileNodeState {
  path: string;
  lastActivity: string;
  editCount: number;
  glowIntensity: number;
  lastAgent: string;
}

export interface TokenUsageSummary {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCostUsd: number;
}

export interface WorldState {
  tick: number;
  agents: Map<string, AgentState>;
  connections: Connection[];
  fileNodes: Map<string, FileNodeState>;
  tokenUsage: TokenUsageSummary;
}

export function createInitialWorldState(): WorldState {
  return {
    tick: 0,
    agents: new Map(),
    connections: [],
    fileNodes: new Map(),
    tokenUsage: {
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalCostUsd: 0,
    },
  };
}
