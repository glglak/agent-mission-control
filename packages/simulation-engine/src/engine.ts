import type { CanonicalEvent } from '@amc/shared';
import type { WorldState } from './state/world-state.js';
import { createInitialWorldState } from './state/world-state.js';
import { reduce } from './state/reducers.js';
import { ReplayController } from './replay/timeline.js';

export type Unsubscribe = () => void;
export type StateListener = (state: WorldState) => void;

/**
 * Main simulation engine. Operates in two modes:
 *
 * - **live**: Events are ingested one at a time via `ingestEvent()`.
 * - **replay**: Events are loaded in bulk via `loadEvents()`, then
 *   played back with `play()`, `pause()`, `seek()`, `setSpeed()`.
 */
export class SimulationEngine {
  private mode: 'live' | 'replay';
  private state: WorldState;
  private listeners: Set<StateListener>;
  private replayController: ReplayController | null;

  constructor(mode: 'live' | 'replay') {
    this.mode = mode;
    this.state = createInitialWorldState();
    this.listeners = new Set();
    this.replayController = mode === 'replay' ? new ReplayController() : null;

    // If replay mode, subscribe to controller updates
    if (this.replayController) {
      this.replayController.subscribe((newState) => {
        this.state = newState;
        this.notifyListeners();
      });
    }
  }

  /**
   * Ingest a single event in live mode.
   * Reduces it into the current state and notifies listeners.
   */
  ingestEvent(event: CanonicalEvent): void {
    if (this.mode !== 'live') {
      throw new Error('ingestEvent() is only available in live mode');
    }
    this.state = reduce(this.state, event);
    this.notifyListeners();
  }

  /**
   * Load a batch of events for replay mode.
   */
  loadEvents(events: CanonicalEvent[]): void {
    if (this.mode !== 'replay') {
      throw new Error('loadEvents() is only available in replay mode');
    }
    this.replayController!.loadEvents(events);
    this.state = this.replayController!.getState();
  }

  /**
   * Get the current world state snapshot.
   */
  getState(): WorldState {
    return this.state;
  }

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   */
  subscribe(listener: StateListener): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // --- Replay controls ---

  play(): void {
    this.ensureReplay('play');
    this.replayController!.play();
  }

  pause(): void {
    this.ensureReplay('pause');
    this.replayController!.pause();
  }

  seek(timestamp: string): void {
    this.ensureReplay('seek');
    this.replayController!.seek(timestamp);
    this.state = this.replayController!.getState();
  }

  setSpeed(speed: number): void {
    this.ensureReplay('setSpeed');
    this.replayController!.setSpeed(speed);
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    if (this.replayController) {
      this.replayController.destroy();
    }
    this.listeners.clear();
  }

  private ensureReplay(method: string): void {
    if (this.mode !== 'replay' || !this.replayController) {
      throw new Error(`${method}() is only available in replay mode`);
    }
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
