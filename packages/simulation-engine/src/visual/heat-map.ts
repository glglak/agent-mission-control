import type { AgentState } from '../state/agent-state.js';

/**
 * Normalizes token usage across a set of agents to produce
 * heat intensity values in the range 0.0 to 1.0.
 *
 * The agent with the highest total token usage gets intensity 1.0.
 * All others are scaled proportionally.
 *
 * @param agents Map of agent states.
 * @returns Map of agent ID to normalized heat intensity.
 */
export function computeHeatMap(agents: Map<string, AgentState>): Map<string, number> {
  const result = new Map<string, number>();

  let maxTokens = 0;
  for (const [, agent] of agents) {
    const total = agent.tokenUsage.promptTokens + agent.tokenUsage.completionTokens;
    if (total > maxTokens) maxTokens = total;
  }

  for (const [id, agent] of agents) {
    if (maxTokens === 0) {
      result.set(id, 0);
    } else {
      const total = agent.tokenUsage.promptTokens + agent.tokenUsage.completionTokens;
      result.set(id, total / maxTokens);
    }
  }

  return result;
}
