// State
export type {
  AgentState,
  WorldState,
  Connection,
  FileNodeState,
  TokenUsageSummary,
} from './state/index.js';
export { createInitialWorldState, reduce } from './state/index.js';

// Zones
export { ZONE_LAYOUTS, DESK_OFFSETS, ZoneManager } from './zones/index.js';
export type { ZoneLayout, Position3D } from './zones/index.js';

// Visual
export {
  getAgentVisualParams,
  computeConnectionVisual,
  computeFileGlowIntensity,
  computeHeatMap,
} from './visual/index.js';
export type { AgentVisualParams, ConnectionLineData } from './visual/index.js';

// Clock
export { WallClock, ReplayClock } from './clock.js';
export type { Clock } from './clock.js';

// Replay
export { EventCursor, ReplayController } from './replay/index.js';
export type { StateListener } from './replay/index.js';

// Engine
export { SimulationEngine } from './engine.js';
export type { Unsubscribe } from './engine.js';
