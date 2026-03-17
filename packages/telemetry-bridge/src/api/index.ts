import type { FastifyInstance } from 'fastify';
import { sessionRoutes } from './routes/sessions.js';
import { agentRoutes } from './routes/agents.js';
import { eventRoutes } from './routes/events.js';
import { healthRoutes } from './routes/health.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(sessionRoutes);
  await app.register(agentRoutes);
  await app.register(eventRoutes);
  await app.register(healthRoutes);
}
