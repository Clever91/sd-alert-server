# sd-alert-server

Internal alert notification server. Receives alerts from `/billing` and `/sd` over HTTP,
persists them in MySQL, and fans them out to mobile devices via FCM v1 (Android + iOS).

Telegram dispatch in `/billing` and `/sd` is unchanged — this server runs alongside it.

## Stack

- Node.js + Fastify + TypeScript
- MySQL 8 (knex migrations)
- FCM HTTP v1 (`google-auth-library` for OAuth2)
- JWT for app auth, static `X-Alert-Key` for server-to-server

## Quick start

```bash
cp .env.example .env
# fill in DB creds, ALERT_API_KEY, JWT_SECRET, FCM_PROJECT_ID, FCM_SERVICE_ACCOUNT_PATH

npm install
npm run migrate:latest
npm run dev
```

Place your Firebase service-account JSON at the path you set in `FCM_SERVICE_ACCOUNT_PATH`
(default `./firebase-service-account.json`). It is gitignored.

## API

### Server-to-server

```
POST /api/v1/alerts
Headers: X-Alert-Key: <ALERT_API_KEY>
Body:   { type, title, body, source, metadata?, dedupe_key? }
```

Types: `system_alert`, `billing_alert`, `mock_license_alert`.

### App-facing

```
POST /api/v1/devices/register     { fcmToken, platform, deviceName? }   -> { jwt }
GET  /api/v1/alerts?type=&unread=&limit=&before=                        -> paginated list
POST /api/v1/alerts/:id/read                                            -> { ok: true }
GET  /api/v1/alerts/unread-count                                        -> { count }
```

## Smoke test

```bash
curl -X POST http://localhost:3000/api/v1/alerts \
  -H "X-Alert-Key: $ALERT_API_KEY" -H "Content-Type: application/json" \
  -d '{"type":"system_alert","title":"test","body":"hi","source":"server"}'
```
