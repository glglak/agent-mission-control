import type { FastifyInstance } from 'fastify';
import { getAgentsBySession, getAllAgents } from '../../store/repositories/agent.repo.js';

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { session_id?: string } }>(
    '/api/agents',
    async (request, reply) => {
      const { session_id } = request.query;
      if (session_id) {
        const agents = getAgentsBySession(session_id);
        return reply.send(agents);
      }
      const agents = getAllAgents();
      return reply.send(agents);
    },
  );
}
