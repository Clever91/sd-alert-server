import { GoogleAuth } from 'google-auth-library';
import { config, AlertType } from '../config';

const auth = new GoogleAuth({
  keyFile: config.fcm.serviceAccountPath,
  scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
});

const SOUND_BY_TYPE: Record<AlertType, string> = {
  system_alert: 'system_alert',
  billing_alert: 'billing_alert',
  mock_license_alert: 'mock_license',
};

const CHANNEL_BY_TYPE: Record<AlertType, string> = {
  system_alert: 'sd_alert_system',
  billing_alert: 'sd_alert_billing',
  mock_license_alert: 'sd_alert_mock_license',
};

export interface FcmSendResult {
  ok: boolean;
  status?: number;
  error?: string;
  body?: string;
  notRegistered?: boolean;
}

export async function sendFcm(
  fcmToken: string,
  platform: 'android' | 'ios',
  type: AlertType,
  title: string,
  body: string,
  data: Record<string, string> = {},
): Promise<FcmSendResult> {
  const client = await auth.getClient();
  const accessToken = (await client.getAccessToken()).token;
  if (!accessToken) return { ok: false, error: 'no_access_token' };

  const sound = SOUND_BY_TYPE[type];
  const channelId = CHANNEL_BY_TYPE[type];

  const message: Record<string, unknown> = {
    token: fcmToken,
    notification: { title, body },
    data: { ...data, type },
    android: {
      priority: 'HIGH',
      notification: {
        channel_id: channelId,
        sound,
        default_sound: false,
      },
    },
    apns: {
      headers: { 'apns-priority': '10' },
      payload: {
        aps: {
          sound: `${sound}.caf`,
          'mutable-content': 1,
        },
      },
    },
  };
  if (platform === 'ios') delete (message as { android?: unknown }).android;
  if (platform === 'android') delete (message as { apns?: unknown }).apns;

  const url = `https://fcm.googleapis.com/v1/projects/${config.fcm.projectId}/messages:send`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  });
  const text = await res.text();
  if (res.ok) return { ok: true, status: res.status, body: text };

  const notRegistered = /UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT/.test(text) || res.status === 404;
  return { ok: false, status: res.status, body: text, notRegistered };
}
