/**
 * Half-life for file glow decay in milliseconds.
 * After this period, glow is at 50% intensity.
 */
const GLOW_HALF_LIFE_MS = 10_000;

/**
 * Computes the glow intensity for a file node based on how recently
 * it was last accessed. Uses exponential decay.
 *
 * @param lastActivityTimestamp ISO timestamp of the last file activity.
 * @param currentTimestamp ISO timestamp of the current time.
 * @returns Glow intensity between 0.0 and 1.0.
 */
export function computeFileGlowIntensity(
  lastActivityTimestamp: string,
  currentTimestamp: string,
): number {
  const lastMs = new Date(lastActivityTimestamp).getTime();
  const nowMs = new Date(currentTimestamp).getTime();
  const elapsed = Math.max(0, nowMs - lastMs);
  return Math.exp((-Math.LN2 * elapsed) / GLOW_HALF_LIFE_MS);
}
