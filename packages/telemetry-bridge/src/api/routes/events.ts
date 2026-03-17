import type { FastifyInstance } from 'fastify';
import { queryEvents } from '../../store/repositories/event.repo.js';

interface EventQuerystring {
  session_id?: string;
  type?: string;
  from?: string;
  to?: string;
  limit?: string;
}

export async function eventRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: EventQuerystring }>(
    '/api/events',
    async (request, reply) => {
      const { session_id, type, from, to, limit } = request.query;

      const events = queryEvents({
        session_id,
        event_type: type,
        from,
        to,
        limit: limit ? parseInt(limit, 10) : undefined,
      });

      // Parse payload JSON strings back to objects
      const parsed = events.map((e) => ({
        ...e,
        payload: e.payload ? JSON.parse(e.payload) : null,
      }));

      return reply.send(parsed);
    },
  );
}
