import type { CanonicalEvent } from '@amc/shared';

export interface Collector {
  /** Unique name for this collector */
  readonly name: string;

  /**
   * Process a raw incoming payload and return zero or more canonical events.
   * Returns null/undefined if the payload is not relevant to this collector.
   */
  process(rawPayload: unknown): CanonicalEvent[] | null;
}
