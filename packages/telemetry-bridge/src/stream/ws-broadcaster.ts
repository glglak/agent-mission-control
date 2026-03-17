import type { WebSocket } from 'ws';
import type { CanonicalEvent, ServerMessage, ClientMessage } from '@amc/shared';
import { EventBus } from './event-bus.js';

interface ClientState {
  ws: WebSocket;
  sessionFilter?: string;
}

export class WsBroadcaster {
  private clients = new Map<WebSocket, ClientState>();

  constructor(private bus: EventBus) {
    this.bus.onEvent((event: CanonicalEvent) => {
      this.broadcast(event);
    });
  }

  addClient(ws: WebSocket): void {
    this.clients.set(ws, { ws });

    ws.on('message', (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString()) as ClientMessage;
        this.handleClientMessage(ws, msg);
      } catch {
        this.sendToClient(ws, { type: 'error', message: 'Invalid message format' });
      }
    });

    ws.on('close', () => {
      this.clients.delete(ws);
    });
  }

  private handleClientMessage(ws: WebSocket, msg: ClientMessage): void {
    const state = this.clients.get(ws);
    if (!state) return;

    switch (msg.type) {
      case 'subscribe':
        state.sessionFilter = msg.session_id;
        break;
      case 'unsubscribe':
        state.sessionFilter = undefined;
        break;
      case 'replay':
        // Replay is handled by the WS handler at the API layer
        break;
    }
  }

  private broadcast(event: CanonicalEvent): void {
    const message: ServerMessage = { type: 'event', data: event };
    const payload = JSON.stringify(message);

    for (const [, state] of this.clients) {
      if (state.ws.readyState !== 1 /* WebSocket.OPEN */) continue;

      // If client has a session filter, only send matching events
      if (state.sessionFilter && state.sessionFilter !== event.session_id) continue;

      state.ws.send(payload);
    }
  }

  private sendToClient(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(msg));
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }
}
