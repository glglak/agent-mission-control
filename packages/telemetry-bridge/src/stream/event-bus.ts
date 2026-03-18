import { EventEmitter } from 'node:events';
import type { CanonicalEvent } from '@amc/shared';

export class EventBus extends EventEmitter {
  publishEvent(event: CanonicalEvent): boolean {
    return super.emit('event', event);
  }

  onEvent(listener: (event: CanonicalEvent) => void): this {
    return super.on('event', listener);
  }

  offEvent(listener: (event: CanonicalEvent) => void): this {
    return super.removeListener('event', listener);
  }

  publish(event: CanonicalEvent): void {
    this.publishEvent(event);
  }
}

export const eventBus = new EventBus();
