import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { CanonicalEvent } from '@amc/shared';
import { normalizePipeline } from '../normalizer/pipeline.js';
import type { EventBus } from '../stream/event-bus.js';
import type { Collector } from './base-collector.js';

export class ClaudeCodeCollector implements Collector {
  readonly name = 'claude-code';

  process(rawPayload: unknown): CanonicalEvent[] | null {
    if (!rawPayload || typeof rawPayload !== 'object') return null;

    const data = rawPayload as Record<string, unknown>;
    if (!data.session_id) return null;

    try {
      return normalizePipeline(data);
    } catch {
      return null;
    }
  }
}

export function registerClaudeCodeEndpoint(
  app: FastifyInstance,
  bus: EventBus,
): void {
  const collector = new ClaudeCodeCollector();

  app.post(
    '/api/collect/claude-code',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body;
      const events = collector.process(body);

      if (!events || events.length === 0) {
        return reply.status(400).send({ error: 'Invalid or unrecognized payload' });
      }

      for (const event of events) {
        bus.publish(event);
      }

      return reply.status(202).send({ accepted: events.length });
    },
  );
}
