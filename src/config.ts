import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '0.0.0.0',
  logLevel: process.env.LOG_LEVEL || 'info',
  alertApiKey: required('ALERT_API_KEY'),
  jwtSecret: required('JWT_SECRET'),
  retentionDays: Number(process.env.ALERT_RETENTION_DAYS || 90),
  dedupeWindowMinutes: Number(process.env.DEDUPE_WINDOW_MINUTES || 10),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    name: required('DB_NAME'),
  },
  fcm: {
    projectId: required('FCM_PROJECT_ID'),
    serviceAccountPath: required('FCM_SERVICE_ACCOUNT_PATH'),
  },
};

export const ALERT_TYPES = ['system_alert', 'billing_alert', 'mock_license_alert'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];
