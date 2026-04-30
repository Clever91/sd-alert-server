import { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config';

export async function requireApiKey(req: FastifyRequest, reply: FastifyReply) {
  const key = req.headers['x-alert-key'];
  if (typeof key !== 'string' || key !== config.alertApiKey) {
    reply.code(401).send({ error: 'invalid_api_key' });
  }
}
