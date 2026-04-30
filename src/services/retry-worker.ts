import { db } from '../db/knex';
import { sendFcm } from './fcm';
import { AlertType } from '../config';

const MAX_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 30_000;

export function startRetryWorker(): NodeJS.Timeout {
  return setInterval(() => {
    void tick().catch(() => {});
  }, POLL_INTERVAL_MS);
}

async function tick() {
  const due = await db('delivery_log')
    .where('status', 'retry')
    .andWhere('next_retry_at', '<=', new Date())
    .andWhere('attempts', '<', MAX_ATTEMPTS)
    .limit(50);

  for (const row of due) {
    const alert = await db('alerts').where({ id: row.alert_id }).first();
    const device = await db('devices').where({ id: row.device_id }).first();
    if (!alert || !device || !device.active) {
      await db('delivery_log').where({ id: row.id }).update({ status: 'failed' });
      continue;
    }
    const res = await sendFcm(
      device.fcm_token,
      device.platform,
      alert.type as AlertType,
      alert.title,
      alert.body,
      { alert_id: String(alert.id), type: alert.type },
    );
    const attempts = row.attempts + 1;
    if (res.ok) {
      await db('delivery_log').where({ id: row.id }).update({
        status: 'sent',
        attempts,
        fcm_response: (res.body || '').slice(0, 1000),
      });
    } else if (res.notRegistered) {
      await db('devices').where({ id: device.id }).update({ active: false });
      await db('delivery_log').where({ id: row.id }).update({
        status: 'failed',
        attempts,
        fcm_response: (res.body || '').slice(0, 1000),
      });
    } else if (attempts >= MAX_ATTEMPTS) {
      await db('delivery_log').where({ id: row.id }).update({
        status: 'failed',
        attempts,
        fcm_response: (res.body || '').slice(0, 1000),
      });
    } else {
      const backoffMs = Math.min(60_000 * 2 ** attempts, 30 * 60_000);
      await db('delivery_log')
        .where({ id: row.id })
        .update({
          attempts,
          next_retry_at: new Date(Date.now() + backoffMs),
          fcm_response: (res.body || '').slice(0, 1000),
        });
    }
  }
}
