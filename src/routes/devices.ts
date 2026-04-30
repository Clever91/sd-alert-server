import { FastifyInstance } from 'fastify';
import { db } from '../db/knex';
import { registerDeviceSchema } from '../schemas/devices';

interface RegisterBody {
  fcmToken: string;
  platform: 'android' | 'ios';
  deviceName?: string;
  userLabel?: string;
}

export async function devicesRoutes(app: FastifyInstance) {
  app.post<{ Body: RegisterBody }>(
    '/devices/register',
    { schema: registerDeviceSchema },
    async (req) => {
      const { fcmToken, platform, deviceName, userLabel } = req.body;

      const existing = await db('devices').where({ fcm_token: fcmToken }).first();
      let deviceId: number;
      if (existing) {
        await db('devices')
          .where({ id: existing.id })
          .update({
            platform,
            device_name: deviceName || existing.device_name,
            user_label: userLabel || existing.user_label,
            active: true,
            last_seen_at: new Date(),
          });
        deviceId = existing.id;
      } else {
        const [id] = await db('devices').insert({
          fcm_token: fcmToken,
          platform,
          device_name: deviceName || null,
          user_label: userLabel || null,
          active: true,
          last_seen_at: new Date(),
        });
        deviceId = id as number;
      }

      const jwt = await app.jwt.sign({ deviceId });
      return { jwt, deviceId };
    },
  );
}
