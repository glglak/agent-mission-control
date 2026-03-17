import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { ClientMessage, ServerMessage, EventType } from '@amc/shared';
import { queryEvents } from '../../store/repositories/event.repo.js';
import type { WsBroadcaster } from '../../stream/ws-broadcaster.js';

export function registerWsHandler(
  app: FastifyInstance,
  broadcaster: WsBroadcaster,
  wsPath: string,
): void {
  app.get(wsPath, { websocket: true }, (socket: WebSocket) => {
    // Register with broadcaster for live event streaming
    broadcaster.addClient(socket);

    // Handle replay requests at the WS level
    socket.on('message', (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString()) as ClientMessage;
        if (msg.type === 'replay') {
          handleReplay(socket, msg.session_id, msg.from, msg.to);
        }
      } catch {
        // Malformed messages are handled by the broadcaster
      }
    });
  });
}

function handleReplay(
  ws: WebSocket,
  sessionId: string,
  from?: string,
  to?: string,
): void {
  const events = queryEvents({
    session_id: sessionId,
    from,
    to,
  });

  for (const row of events) {
    const message: ServerMessage = {
      type: 'event',
      data: {
        event_id: row.event_id,
        timestamp: row.timestamp,
        session_id: row.session_id,
        agent_id: row.agent_id ?? undefined,
        event_type: row.event_type as EventType,
        payload: row.payload ? JSON.parse(row.payload) : undefined,
      },
    };

    if (ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  }
}
