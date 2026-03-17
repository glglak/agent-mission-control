import type { CanonicalEvent } from '@amc/shared';
import { ReplayClock } from '../clock.js';
import { EventCursor } from './event-cursor.js';
import { reduce } from '../state/reducers.js';
import type { WorldState } from '../state/world-state.js';
import { createInitialWorldState } from '../state/world-state.js';

export type StateListener = (state: WorldState) => void;

/**
 * ReplayController drives events from an EventCursor through the
 * state reducer based on a ReplayClock, producing world state updates
 * on each frame.
 */
export class ReplayController {
  private clock: ReplayClock;
  private cursor: EventCursor;
  private state: WorldState;
  private listeners: Set<StateListener>;
  private animationFrameId: number | null;
  private originTimestamp: number;

  constructor() {
    this.clock = new ReplayClock(0);
    this.cursor = new EventCursor();
    this.state = createInitialWorldState();
    this.listeners = new Set();
    this.animationFrameId = null;
    this.originTimestamp = 0;
  }

  loadEvents(events: CanonicalEvent[]): void {
    this.cursor = new EventCursor(events);
    this.state = createInitialWorldState();

    // Set the origin to the first event's timestamp
    const first = this.cursor.peek();
    if (first) {
      this.originTimestamp = new Date(first.timestamp).getTime();
    }
    this.clock.seek(0);
    this.notifyListeners();
  }

  play(): void {
    this.clock.play();
    this.scheduleFrame();
  }

  pause(): void {
    this.clock.pause();
    this.cancelFrame();
  }

  seek(timestamp: string): void {
    const targetMs = new Date(timestamp).getTime() - this.originTimestamp;
    this.clock.seek(targetMs);

    // Rebuild state from scratch up to this point
    this.cursor.reset();
    this.state = createInitialWorldState();
    const events = this.cursor.consumeUpTo(timestamp);
    for (const event of events) {
      this.state = reduce(this.state, event);
    }
    this.notifyListeners();
  }

  setSpeed(speed: number): void {
    this.clock.setSpeed(speed);
  }

  getState(): WorldState {
    return this.state;
  }

  getClock(): ReplayClock {
    return this.clock;
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Advance one frame: advance the clock, consume events up to current time,
   * and reduce them into state.
   */
  tick(): void {
    this.clock.advance();
    const currentMs = this.clock.now();
    const currentTimestamp = new Date(this.originTimestamp + currentMs).toISOString();

    const events = this.cursor.consumeUpTo(currentTimestamp);
    if (events.length > 0) {
      for (const event of events) {
        this.state = reduce(this.state, event);
      }
      this.notifyListeners();
    }
  }

  destroy(): void {
    this.cancelFrame();
    this.listeners.clear();
  }

  private scheduleFrame(): void {
    if (this.animationFrameId !== null) return;
    const loop = () => {
      this.tick();
      if (this.clock.playing && this.cursor.hasNext()) {
        this.animationFrameId = (typeof requestAnimationFrame !== 'undefined'
          ? requestAnimationFrame(loop)
          : (setTimeout(loop, 16) as unknown as number));
      } else {
        this.animationFrameId = null;
      }
    };
    this.animationFrameId = (typeof requestAnimationFrame !== 'undefined'
      ? requestAnimationFrame(loop)
      : (setTimeout(loop, 16) as unknown as number));
  }

  private cancelFrame(): void {
    if (this.animationFrameId !== null) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.animationFrameId);
      } else {
        clearTimeout(this.animationFrameId);
      }
      this.animationFrameId = null;
    }
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
