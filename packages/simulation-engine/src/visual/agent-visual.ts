import { AgentVisualState } from '@amc/shared';

export interface AgentVisualParams {
  color: string;
  pulseSpeed: number;
  particleType: 'none' | 'sparks' | 'glow' | 'warning' | 'rings';
  emissiveIntensity: number;
}

const VISUAL_MAP: Record<AgentVisualState, AgentVisualParams> = {
  [AgentVisualState.Working]: {
    color: '#00ccff',
    pulseSpeed: 1.5,
    particleType: 'sparks',
    emissiveIntensity: 0.8,
  },
  [AgentVisualState.Thinking]: {
    color: '#aa88ff',
    pulseSpeed: 0.8,
    particleType: 'glow',
    emissiveIntensity: 0.5,
  },
  [AgentVisualState.Blocked]: {
    color: '#ff4444',
    pulseSpeed: 2.5,
    particleType: 'warning',
    emissiveIntensity: 1.0,
  },
  [AgentVisualState.Communicating]: {
    color: '#44ff88',
    pulseSpeed: 2.0,
    particleType: 'rings',
    emissiveIntensity: 0.7,
  },
  [AgentVisualState.Idle]: {
    color: '#888888',
    pulseSpeed: 0.3,
    particleType: 'none',
    emissiveIntensity: 0.1,
  },
};

/**
 * Maps an AgentVisualState to rendering parameters.
 */
export function getAgentVisualParams(state: AgentVisualState): AgentVisualParams {
  return VISUAL_MAP[state];
}
