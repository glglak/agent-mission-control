import type { Connection } from '../state/world-state.js';

export interface ConnectionLineData {
  fromPosition: { x: number; y: number; z: number };
  toPosition: { x: number; y: number; z: number };
  /** Interpolated midpoint for curved rendering. */
  midPosition: { x: number; y: number; z: number };
  /** 0..1 progress for animation along the line. */
  animationProgress: number;
  /** 0..1 opacity derived from decay. */
  opacity: number;
}

/**
 * Computes visual line data for a connection between two agents.
 *
 * @param connection The connection to render.
 * @param fromPos The source agent position.
 * @param toPos The target agent position.
 * @param elapsedMs Time elapsed since the connection was created.
 * @param animationDurationMs Duration of one full animation cycle.
 */
export function computeConnectionVisual(
  connection: Connection,
  fromPos: { x: number; y: number; z: number },
  toPos: { x: number; y: number; z: number },
  elapsedMs: number,
  animationDurationMs = 2000,
): ConnectionLineData {
  // Midpoint raised on Y for an arc effect
  const midPosition = {
    x: (fromPos.x + toPos.x) / 2,
    y: (fromPos.y + toPos.y) / 2 + 3,
    z: (fromPos.z + toPos.z) / 2,
  };

  const animationProgress = (elapsedMs % animationDurationMs) / animationDurationMs;
  const opacity = connection.decay;

  return {
    fromPosition: { ...fromPos },
    toPosition: { ...toPos },
    midPosition,
    animationProgress,
    opacity,
  };
}
