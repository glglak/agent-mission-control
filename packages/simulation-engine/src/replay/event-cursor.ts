import type { CanonicalEvent } from '@amc/shared';

/**
 * Holds a sorted array of events and provides cursor-based traversal.
 */
export class EventCursor {
  private events: CanonicalEvent[];
  private position: number;

  constructor(events: CanonicalEvent[] = []) {
    this.events = [...events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    this.position = 0;
  }

  /** Returns the next event and advances the cursor, or undefined if at end. */
  next(): CanonicalEvent | undefined {
    if (this.position >= this.events.length) return undefined;
    return this.events[this.position++];
  }

  /** Returns the next event without advancing the cursor. */
  peek(): CanonicalEvent | undefined {
    if (this.position >= this.events.length) return undefined;
    return this.events[this.position];
  }

  /** Whether there are more events. */
  hasNext(): boolean {
    return this.position < this.events.length;
  }

  /**
   * Seek to the first event at or after the given timestamp.
   * Uses binary search for efficiency.
   */
  seek(timestamp: string): void {
    const targetMs = new Date(timestamp).getTime();
    let lo = 0;
    let hi = this.events.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (new Date(this.events[mid].timestamp).getTime() < targetMs) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    this.position = lo;
  }

  /** Reset cursor to the beginning. */
  reset(): void {
    this.position = 0;
  }

  /** Get the current cursor position index. */
  getPosition(): number {
    return this.position;
  }

  /** Get total number of events. */
  get length(): number {
    return this.events.length;
  }

  /**
   * Get all events up to and including the given timestamp
   * starting from the current cursor position, advancing the cursor.
   */
  consumeUpTo(timestamp: string): CanonicalEvent[] {
    const targetMs = new Date(timestamp).getTime();
    const result: CanonicalEvent[] = [];
    while (this.position < this.events.length) {
      const evtMs = new Date(this.events[this.position].timestamp).getTime();
      if (evtMs > targetMs) break;
      result.push(this.events[this.position++]);
    }
    return result;
  }
}
