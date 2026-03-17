import type { AgentZone, AgentVisualState } from '@amc/shared';

export interface AgentState {
  id: string;
  name: string;
  zone: AgentZone;
  visualState: AgentVisualState;
  position: { x: number; y: number; z: number };
  currentTask: string | null;
  tokenUsage: { promptTokens: number; completionTokens: number };
  lastEventTimestamp: string;
  heatIntensity: number;
}
