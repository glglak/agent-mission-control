import type { FastifyInstance } from 'fastify';
import { getAllSessions, getSessionById } from '../../store/repositories/session.repo.js';

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/sessions', async (_request, reply) => {
    const sessions = getAllSessions();
    return reply.send(sessions);
  });

  app.get<{ Params: { id: string } }>(
    '/api/sessions/:id',
    async (request, reply) => {
      const session = getSessionById(request.params.id);
      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }
      return reply.send(session);
    },
  );
}
