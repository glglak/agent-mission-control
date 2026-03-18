import { EventType, AgentZone, AgentVisualState } from '@amc/shared';
import type { CanonicalEvent } from '@amc/shared';
import type { AgentState } from './agent-state.js';
import type { WorldState, Connection, FileNodeState } from './world-state.js';
import { createInitialWorldState } from './world-state.js';

/** Maximum age of a connection in milliseconds before it is removed. */
const CONNECTION_MAX_AGE_MS = 30_000;

/** Decay rate for connection opacity per second. */
const CONNECTION_DECAY_PER_SEC = 1 / (CONNECTION_MAX_AGE_MS / 1000);

/** Decay rate for file glow per second (exponential). */
const FILE_GLOW_HALF_LIFE_MS = 10_000;

const TEST_TOOL_PATTERNS = ['test', 'pytest', 'jest', 'vitest', 'mocha', 'spec'];

function isTestTool(toolName: string): boolean {
  const lower = toolName.toLowerCase();
  return TEST_TOOL_PATTERNS.some((p) => lower.includes(p));
}

function cloneAgents(agents: Map<string, AgentState>): Map<string, AgentState> {
  const cloned = new Map<string, AgentState>();
  for (const [k, v] of agents) {
    cloned.set(k, { ...v, position: { ...v.position }, tokenUsage: { ...v.tokenUsage } });
  }
  return cloned;
}

function cloneFileNodes(nodes: Map<string, FileNodeState>): Map<string, FileNodeState> {
  const cloned = new Map<string, FileNodeState>();
  for (const [k, v] of nodes) {
    cloned.set(k, { ...v });
  }
  return cloned;
}

function upsertFileNode(
  fileNodes: Map<string, FileNodeState>,
  filePath: string,
  agentId: string,
  timestamp: string,
  isEdit: boolean,
): void {
  const existing = fileNodes.get(filePath);
  if (existing) {
    existing.lastActivity = timestamp;
    existing.glowIntensity = 1.0;
    existing.lastAgent = agentId;
    if (isEdit) {
      existing.editCount += 1;
    }
  } else {
    fileNodes.set(filePath, {
      path: filePath,
      lastActivity: timestamp,
      editCount: isEdit ? 1 : 0,
      glowIntensity: 1.0,
      lastAgent: agentId,
    });
  }
}

function decayConnections(connections: Connection[], currentTimestamp: string): Connection[] {
  const now = new Date(currentTimestamp).getTime();
  return connections
    .map((c) => {
      const age = now - new Date(c.timestamp).getTime();
      const decay = Math.max(0, 1 - (age / 1000) * CONNECTION_DECAY_PER_SEC);
      return { ...c, decay };
    })
    .filter((c) => c.decay > 0);
}

function decayFileGlows(fileNodes: Map<string, FileNodeState>, currentTimestamp: string): void {
  const now = new Date(currentTimestamp).getTime();
  for (const [, node] of fileNodes) {
    const age = now - new Date(node.lastActivity).getTime();
    node.glowIntensity = Math.exp((-Math.LN2 * age) / FILE_GLOW_HALF_LIFE_MS);
  }
}

function recalculateHeat(agents: Map<string, AgentState>): void {
  let maxTokens = 0;
  for (const [, agent] of agents) {
    const total = agent.tokenUsage.promptTokens + agent.tokenUsage.completionTokens;
    if (total > maxTokens) maxTokens = total;
  }
  for (const [, agent] of agents) {
    if (maxTokens === 0) {
      agent.heatIntensity = 0;
    } else {
      const total = agent.tokenUsage.promptTokens + agent.tokenUsage.completionTokens;
      agent.heatIntensity = total / maxTokens;
    }
  }
}

function getPayload(event: CanonicalEvent): Record<string, unknown> {
  return (event.payload ?? {}) as Record<string, unknown>;
}

export function reduce(state: WorldState, event: CanonicalEvent): WorldState {
  const agents = cloneAgents(state.agents);
  let connections = [...state.connections];
  const fileNodes = cloneFileNodes(state.fileNodes);
  const tokenUsage = { ...state.tokenUsage };
  const tick = state.tick + 1;

  const agentId = event.agent_id ?? '';
  const payload = getPayload(event);
  const timestamp = event.timestamp;

  switch (event.event_type) {
    case EventType.SessionStarted: {
      const fresh = createInitialWorldState();
      fresh.tick = tick;
      // Preserve accumulated token usage across session reloads
      fresh.tokenUsage = { ...tokenUsage };
      return fresh;
    }

    case EventType.SessionEnded: {
      // Preserve final state — don't reset agents
      // Token counts and zones remain for historical viewing
      break;
    }

    case EventType.AgentRegistered: {
      if (agentId && !agents.has(agentId)) {
        const name = (payload.name as string) ?? agentId;
        agents.set(agentId, {
          id: agentId,
          name,
          zone: AgentZone.Idle,
          visualState: AgentVisualState.Idle,
          position: { x: 0, y: 0, z: 0 },
          currentTask: null,
          tokenUsage: { promptTokens: 0, completionTokens: 0 },
          lastEventTimestamp: timestamp,
          heatIntensity: 0,
        });
      }
      break;
    }

    case EventType.AgentStarted: {
      const agent = agents.get(agentId);
      if (agent) {
        agent.visualState = AgentVisualState.Working;
        agent.lastEventTimestamp = timestamp;
        if (payload.task) {
          agent.currentTask = payload.task as string;
        }
      }
      break;
    }

    case EventType.TaskAssigned: {
      const targetId = (payload.assigned_to as string) ?? agentId;
      const agent = agents.get(targetId);
      if (agent) {
        agent.zone = AgentZone.Planning;
        agent.visualState = AgentVisualState.Working;
        agent.currentTask = (payload.description as string) ?? null;
        agent.lastEventTimestamp = timestamp;
      }
      break;
    }

    case EventType.ToolCalled: {
      const agent = agents.get(agentId);
      if (agent) {
        const toolName = (payload.tool_name as string) ?? '';
        agent.zone = isTestTool(toolName) ? AgentZone.Testing : AgentZone.Coding;
        agent.visualState = AgentVisualState.Working;
        agent.lastEventTimestamp = timestamp;

        const filePath = payload.file_path as string | undefined;
        if (filePath) {
          upsertFileNode(fileNodes, filePath, agentId, timestamp, false);
        }
      }
      break;
    }

    case EventType.ToolResult: {
      const agent = agents.get(agentId);
      if (agent) {
        agent.lastEventTimestamp = timestamp;
      }
      break;
    }

    case EventType.FileOpened: {
      const filePath = payload.file_path as string | undefined;
      if (filePath) {
        upsertFileNode(fileNodes, filePath, agentId, timestamp, false);
      }
      const agent = agents.get(agentId);
      if (agent) {
        agent.lastEventTimestamp = timestamp;
      }
      break;
    }

    case EventType.FileEdited: {
      const filePath = payload.file_path as string | undefined;
      if (filePath) {
        upsertFileNode(fileNodes, filePath, agentId, timestamp, true);
      }
      const agent = agents.get(agentId);
      if (agent) {
        agent.lastEventTimestamp = timestamp;
      }
      break;
    }

    case EventType.FileSaved: {
      const filePath = payload.file_path as string | undefined;
      if (filePath) {
        upsertFileNode(fileNodes, filePath, agentId, timestamp, false);
      }
      const agent = agents.get(agentId);
      if (agent) {
        agent.lastEventTimestamp = timestamp;
      }
      break;
    }

    case EventType.AgentBlocked: {
      const agent = agents.get(agentId);
      if (agent) {
        agent.visualState = AgentVisualState.Blocked;
        agent.lastEventTimestamp = timestamp;
      }
      break;
    }

    case EventType.AgentIdle: {
      const agent = agents.get(agentId);
      if (agent) {
        agent.zone = AgentZone.Idle;
        agent.visualState = AgentVisualState.Idle;
        // Don't clear currentTask — preserve it for historical viewing
        agent.lastEventTimestamp = timestamp;
      }
      break;
    }

    case EventType.AgentCompleted: {
      const agent = agents.get(agentId);
      if (agent) {
        // Keep zone — preserve last working position for historical view
        // Only mark as idle visual state, don't reset zone or tokens
        const success = payload.success as boolean ?? true;
        if (!success) {
          // Agent was "fired" — mark as blocked for dramatic effect
          agent.visualState = AgentVisualState.Blocked;
        } else {
          agent.visualState = AgentVisualState.Idle;
        }
        agent.currentTask = null;
        agent.lastEventTimestamp = timestamp;
      }
      break;
    }

    case EventType.AgentMessageSent: {
      const agent = agents.get(agentId);
      if (agent) {
        agent.visualState = AgentVisualState.Communicating;
        agent.lastEventTimestamp = timestamp;
      }
      const toAgentId = payload.to_agent_id as string | undefined;
      if (agentId && toAgentId) {
        const conn: Connection = {
          id: `${agentId}->${toAgentId}@${timestamp}`,
          fromAgentId: agentId,
          toAgentId,
          timestamp,
          decay: 1.0,
        };
        connections.push(conn);
      }
      break;
    }

    case EventType.TokenUsageUpdated: {
      const promptTokens = (payload.prompt_tokens as number) ?? 0;
      const completionTokens = (payload.completion_tokens as number) ?? 0;

      tokenUsage.totalPromptTokens += promptTokens;
      tokenUsage.totalCompletionTokens += completionTokens;

      const agent = agents.get(agentId);
      if (agent) {
        agent.tokenUsage.promptTokens += promptTokens;
        agent.tokenUsage.completionTokens += completionTokens;
        agent.lastEventTimestamp = timestamp;
      }
      recalculateHeat(agents);
      break;
    }

    case EventType.CostEstimateUpdated: {
      const cumulativeCost = (payload.cumulative_cost_usd as number) ?? 0;
      tokenUsage.totalCostUsd = cumulativeCost;
      break;
    }

    default:
      // Unknown event types are ignored
      break;
  }

  // Decay connections and file glows
  connections = decayConnections(connections, timestamp);
  decayFileGlows(fileNodes, timestamp);

  return { tick, agents, connections, fileNodes, tokenUsage };
}
