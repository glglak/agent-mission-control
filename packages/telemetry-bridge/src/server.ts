import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import type { CanonicalEvent } from '@amc/shared';
import { EventType } from '@amc/shared';
import type { Config } from './config.js';
import { openDatabase, closeDatabase } from './store/database.js';
import {
  insertEvent,
  insertFileActivity,
  insertTokenUsage,
  insertMessage,
} from './store/repositories/event.repo.js';
import {
  createSession,
  endSession,
  getSessionById,
} from './store/repositories/session.repo.js';
import {
  createAgent,
  updateAgentStatus,
} from './store/repositories/agent.repo.js';
import { eventBus } from './stream/event-bus.js';
import { WsBroadcaster } from './stream/ws-broadcaster.js';
import { registerRoutes } from './api/index.js';
import { registerWsHandler } from './api/ws/handler.js';
import { registerClaudeCodeEndpoint } from './collectors/claude-code.js';

/**
 * Write an event to all relevant DB tables based on its type.
 */
function persistEvent(event: CanonicalEvent): void {
  // Auto-create session if we haven't seen it yet
  if (event.session_id && event.event_type !== EventType.SessionStarted) {
    const existing = getSessionById(event.session_id);
    if (!existing) {
      createSession(event.session_id, event.timestamp, { auto_created: true });
    }
  }

  // Always write to the events table
  insertEvent(
    event.event_id,
    event.timestamp,
    event.session_id,
    event.event_type,
    event.agent_id,
    event.payload as Record<string, unknown> | undefined,
  );

  const payload = event.payload as Record<string, unknown> | undefined;

  // Handle side-effects per event type
  switch (event.event_type) {
    case EventType.SessionStarted:
      createSession(
        event.session_id,
        event.timestamp,
        payload?.['metadata'] as Record<string, unknown> | undefined,
      );
      break;

    case EventType.SessionEnded:
      endSession(event.session_id, event.timestamp);
      break;

    case EventType.AgentRegistered:
      if (event.agent_id && payload) {
        createAgent(
          event.agent_id,
          event.session_id,
          (payload['name'] as string) ?? 'unknown',
          event.timestamp,
          payload['type'] as string | undefined,
        );
      }
      break;

    case EventType.AgentStarted:
      if (event.agent_id) updateAgentStatus(event.agent_id, 'active');
      break;

    case EventType.AgentIdle:
      if (event.agent_id) updateAgentStatus(event.agent_id, 'idle');
      break;

    case EventType.AgentBlocked:
      if (event.agent_id) updateAgentStatus(event.agent_id, 'blocked');
      break;

    case EventType.AgentCompleted:
      if (event.agent_id) updateAgentStatus(event.agent_id, 'completed');
      break;

    case EventType.FileOpened:
    case EventType.FileEdited:
    case EventType.FileSaved:
      if (payload?.['file_path']) {
        insertFileActivity(
          event.event_id,
          payload['file_path'] as string,
          event.event_type,
          event.agent_id,
          event.timestamp,
        );
      }
      break;

    case EventType.TokenUsageUpdated:
      if (payload) {
        insertTokenUsage(
          event.event_id,
          event.agent_id,
          event.session_id,
          (payload['prompt_tokens'] as number) ?? 0,
          (payload['completion_tokens'] as number) ?? 0,
          payload['model'] as string | undefined,
          event.timestamp,
        );
      }
      break;

    case EventType.AgentMessageSent:
      if (payload && event.agent_id) {
        insertMessage(
          event.event_id,
          event.agent_id,
          payload['to_agent_id'] as string,
          payload['content'] as string,
          event.timestamp,
        );
      }
      break;

    case EventType.AgentMessageReceived:
      if (payload && event.agent_id) {
        insertMessage(
          event.event_id,
          payload['from_agent_id'] as string,
          event.agent_id,
          payload['content'] as string,
          event.timestamp,
        );
      }
      break;
  }
}

export async function createServer(config: Config) {
  const app = Fastify({ logger: true });

  // Initialize database
  openDatabase(config.dbPath);

  // Register plugins
  await app.register(cors, { origin: true });
  await app.register(websocket);

  // Wire event bus to DB writer
  eventBus.onEvent((event: CanonicalEvent) => {
    try {
      persistEvent(event);
    } catch (err) {
      app.log.error({ err, event_id: event.event_id }, 'Failed to persist event');
    }
  });

  // Set up WebSocket broadcaster
  const broadcaster = new WsBroadcaster(eventBus);

  // Register REST API routes
  await registerRoutes(app);

  // Register collector endpoints
  registerClaudeCodeEndpoint(app, eventBus);

  // Register WebSocket handler
  registerWsHandler(app, broadcaster, config.wsPath);

  // Graceful shutdown
  const shutdown = async () => {
    app.log.info('Shutting down...');
    closeDatabase();
    await app.close();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return app;
}
