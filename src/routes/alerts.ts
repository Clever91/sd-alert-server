import { FastifyInstance } from 'fastify';
import { db } from '../db/knex';
import { config, AlertType } from '../config';
import { requireApiKey } from '../middleware/apiKey';
import { requireDeviceJwt } from '../middleware/jwt';
import { dispatchAlertToAllDevices } from '../services/dispatcher';
import { postAlertSchema, listAlertsSchema } from '../schemas/alerts';

interface PostAlertBody {
  type: AlertType;
  title: string;
  body: string;
  source: string;
  metadata?: Record<string, unknown>;
  dedupe_key?: string;
}

export async function alertsRoutes(app: FastifyInstance) {
  // Server-to-server: emit a new alert
  app.post<{ Body: PostAlertBody }>(
    '/alerts',
    { preHandler: requireApiKey, schema: postAlertSchema },
    async (req, reply) => {
      const { type, title, body, source, metadata, dedupe_key } = req.body;

      if (dedupe_key) {
        const since = new Date(Date.now() - config.dedupeWindowMinutes * 60_000);
        const existing = await db('alerts')
          .where({ type, dedupe_key })
          .andWhere('created_at', '>=', since)
          .first();
        if (existing) {
          return reply.send({ id: existing.id, status: 'deduped' });
        }
      }

      const [id] = await db('alerts').insert({
        type,
        title,
        body,
        source,
        metadata: metadata ? JSON.stringify(metadata) : null,
        dedupe_key: dedupe_key || null,
      });

      void dispatchAlertToAllDevices({
        id: id as number,
        type,
        title,
        body,
        metadata: metadata || null,
      });

      return reply.send({ id, status: 'queued' });
    },
  );

  // App-facing: list alerts (paginated, filterable)
  app.get<{ Querystring: { type?: AlertType; unread?: '0' | '1'; limit?: number; before?: number } }>(
    '/alerts',
    { preHandler: requireDeviceJwt, schema: listAlertsSchema },
    async (req) => {
      const deviceId = req.user.deviceId;
      const { type, unread, before } = req.query;
      const limit = req.query.limit ?? 50;

      let q = db('alerts as a')
        .leftJoin('alert_reads as r', function () {
          this.on('r.alert_id', '=', 'a.id').andOn('r.device_id', '=', db.raw('?', [deviceId]));
        })
        .select(
          'a.id',
          'a.type',
          'a.title',
          'a.body',
          'a.source',
          'a.metadata',
          'a.created_at',
          db.raw('CASE WHEN r.alert_id IS NULL THEN 0 ELSE 1 END as `read`'),
        )
        .orderBy('a.id', 'desc')
        .limit(limit);

      if (type) q = q.where('a.type', type);
      if (before) q = q.where('a.id', '<', before);
      if (unread === '1') q = q.whereNull('r.alert_id');

      const rows = await q;
      return { items: rows };
    },
  );

  // App-facing: mark as read
  app.post<{ Params: { id: string } }>(
    '/alerts/:id/read',
    { preHandler: requireDeviceJwt },
    async (req, reply) => {
      const deviceId = req.user.deviceId;
      const alertId = Number(req.params.id);
      if (!Number.isFinite(alertId)) return reply.code(400).send({ error: 'bad_id' });
      await db('alert_reads')
        .insert({ device_id: deviceId, alert_id: alertId })
        .onConflict(['device_id', 'alert_id'])
        .ignore();
      return { ok: true };
    },
  );

  // App-facing: unread count
  app.get(
    '/alerts/unread-count',
    { preHandler: requireDeviceJwt },
    async (req) => {
      const deviceId = req.user.deviceId;
      const row = await db('alerts as a')
        .leftJoin('alert_reads as r', function () {
          this.on('r.alert_id', '=', 'a.id').andOn('r.device_id', '=', db.raw('?', [deviceId]));
        })
        .whereNull('r.alert_id')
        .count<{ c: number }>({ c: 'a.id' })
        .first();
      return { count: Number(row?.c || 0) };
    },
  );
}
