import type { FastifyInstance } from 'fastify';
import type { SessionRow } from '../../store/repositories/session.repo.js';
import { getAllSessions, getSessionById } from '../../store/repositories/session.repo.js';

function parseSessionMetadata(session: SessionRow) {
  try {
    return { ...session, metadata: session.metadata ? JSON.parse(session.metadata) : null };
  } catch {
    return { ...session, metadata: null };
  }
}

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/sessions', async (_request, reply) => {
    const sessions = getAllSessions().map(parseSessionMetadata);
    return reply.send(sessions);
  });

  app.get<{ Params: { id: string } }>(
    '/api/sessions/:id',
    async (request, reply) => {
      const session = getSessionById(request.params.id);
      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }
      return reply.send(parseSessionMetadata(session));
    },
  );
}
