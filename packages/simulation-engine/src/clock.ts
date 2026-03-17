/**
 * Clock abstraction for the simulation engine.
 * Supports wall-clock time (live mode) and a manually-controlled replay clock.
 */

export interface Clock {
  /** Returns the current time in milliseconds. */
  now(): number;
}

/**
 * Wall clock uses the real system time.
 */
export class WallClock implements Clock {
  now(): number {
    return Date.now();
  }
}

/**
 * Replay clock that can be manually advanced, paused, and seeked.
 */
export class ReplayClock implements Clock {
  private _currentTime: number;
  private _playing: boolean;
  private _speed: number;
  private _lastRealTime: number;

  constructor(startTime = 0) {
    this._currentTime = startTime;
    this._playing = false;
    this._speed = 1.0;
    this._lastRealTime = Date.now();
  }

  now(): number {
    return this._currentTime;
  }

  get playing(): boolean {
    return this._playing;
  }

  get speed(): number {
    return this._speed;
  }

  play(): void {
    if (!this._playing) {
      this._playing = true;
      this._lastRealTime = Date.now();
    }
  }

  pause(): void {
    if (this._playing) {
      this.advance();
      this._playing = false;
    }
  }

  seek(timeMs: number): void {
    this._currentTime = timeMs;
    this._lastRealTime = Date.now();
  }

  setSpeed(speed: number): void {
    if (this._playing) {
      this.advance();
    }
    this._speed = Math.max(0, speed);
  }

  /**
   * Advance the clock based on real elapsed time and speed multiplier.
   * Should be called on each frame/tick when playing.
   */
  advance(): void {
    if (!this._playing) return;
    const realNow = Date.now();
    const realDelta = realNow - this._lastRealTime;
    this._currentTime += realDelta * this._speed;
    this._lastRealTime = realNow;
  }
}
