import { db } from '../db/knex';
import { sendFcm } from './fcm';
import { AlertType } from '../config';

export interface AlertRow {
  id: number;
  type: AlertType;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
}

export async function dispatchAlertToAllDevices(alert: AlertRow): Promise<void> {
  const devices = await db('devices').where({ active: true }).select('id', 'fcm_token', 'platform');
  for (const d of devices) {
    void sendOneAndLog(alert, d.id, d.fcm_token, d.platform).catch(() => {});
  }
}

async function sendOneAndLog(
  alert: AlertRow,
  deviceId: number,
  fcmToken: string,
  platform: 'android' | 'ios',
) {
  const data: Record<string, string> = { alert_id: String(alert.id), type: alert.type };
  const res = await sendFcm(fcmToken, platform, alert.type, alert.title, alert.body, data);

  if (res.ok) {
    await db('delivery_log').insert({
      alert_id: alert.id,
      device_id: deviceId,
      status: 'sent',
      fcm_response: (res.body || '').slice(0, 1000),
      attempts: 1,
    });
    return;
  }

  if (res.notRegistered) {
    await db('devices').where({ id: deviceId }).update({ active: false });
    await db('delivery_log').insert({
      alert_id: alert.id,
      device_id: deviceId,
      status: 'failed',
      fcm_response: (res.body || '').slice(0, 1000),
      attempts: 1,
    });
    return;
  }

  await db('delivery_log').insert({
    alert_id: alert.id,
    device_id: deviceId,
    status: 'retry',
    fcm_response: (res.body || '').slice(0, 1000),
    attempts: 1,
    next_retry_at: new Date(Date.now() + 60_000),
  });
}
