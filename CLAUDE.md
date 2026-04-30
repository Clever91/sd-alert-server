# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev               # ts-node-dev with reload
npm run build             # tsc -> dist/
npm start                 # node dist/server.js (after build)
npm run lint              # eslint src --ext .ts
npm test                  # vitest run (whole suite)
npx vitest run path/to/file.test.ts          # single file
npx vitest run -t "test name substring"      # single test by name
npm run migrate:latest                        # apply migrations
npm run migrate:make <name>                   # create new migration
npm run migrate:rollback                      # roll back latest batch

# Docker
docker compose up --build                     # db + one-shot migrate + app
docker compose run --rm migrate               # re-run migrations only
```

Migrations are plain JS (CommonJS, knex API) under `migrations/`, not TS — they run directly via the `knex` CLI without a build step.

## Architecture

Fastify HTTP server with two distinct surface areas, gated by different auth schemes:

- **Server-to-server ingress** (`POST /api/v1/alerts`) — gated by `requireApiKey` (static `X-Alert-Key` header). Upstream services (`/billing`, `/sd`) post alerts here. Telegram dispatch in those upstream services is unchanged; this server is an additive mobile-fanout path.
- **App-facing surface** (`/api/v1/devices/register`, `/api/v1/alerts*`) — `register` is unauthenticated and mints a device JWT; everything else requires `requireDeviceJwt`. JWT payload is `{ deviceId }`, registered as a Fastify type augmentation in `src/middleware/jwt.ts`.

Both surfaces are mounted under one `/api/v1` prefix in `src/server.ts`.

### Alert lifecycle

1. `POST /alerts` → optional dedupe (same `type` + `dedupe_key` within `DEDUPE_WINDOW_MINUTES` returns `{ status: 'deduped' }` without inserting). Otherwise insert into `alerts` and return `{ status: 'queued' }` immediately.
2. `dispatchAlertToAllDevices` is fire-and-forget (`void`) — the HTTP response does NOT wait for FCM. Per-device sends run in parallel and each writes a `delivery_log` row with status `sent`, `failed`, or `retry`.
3. FCM "not registered"–style errors (`UNREGISTERED`, `NOT_FOUND`, `INVALID_ARGUMENT`, or HTTP 404) flip `devices.active = false` and mark delivery `failed` — no retry.
4. Other failures → `delivery_log` row with `status='retry'`, `next_retry_at = now + 60s`.
5. `startRetryWorker` polls every 30s for due retries (`MAX_ATTEMPTS = 5`, exponential backoff capped at 30 min). Worker handle is cleared on `SIGTERM`/`SIGINT` shutdown in `src/server.ts`.

### Read state

`alert_reads` is a `(device_id, alert_id)` composite-primary join table. The list endpoint LEFT JOINs it with the device's id bound as a query parameter (so each device sees its own read state); the `read` flag is computed as `CASE WHEN r.alert_id IS NULL THEN 0 ELSE 1 END`. `unread=1` translates to `WHERE r.alert_id IS NULL`. Marking read uses `INSERT … ON CONFLICT IGNORE` so it's idempotent.

### Per-type FCM mapping

`src/services/fcm.ts` hard-codes per–`AlertType` Android channel IDs and sound names (and `.caf` filenames for APNs). When adding a new alert type, update three places: `ALERT_TYPES` in `src/config.ts` (drives both the TS union and the JSON schema enum in `src/schemas/alerts.ts`), and the `SOUND_BY_TYPE` / `CHANNEL_BY_TYPE` maps in `fcm.ts`. The Android client must register a notification channel with the matching ID, otherwise the custom sound is dropped.

### Schemas

JSON Schemas in `src/schemas/` are passed via Fastify's `schema` option for both validation and (server-side) coercion. They use `additionalProperties: false`, so adding a new request field requires editing the schema and the route's TS body interface.

### Config

`src/config.ts` calls `required()` for env vars that have no safe default (DB creds, `ALERT_API_KEY`, `JWT_SECRET`, FCM project + service-account path) — the process throws on boot if any are missing. `knexfile.js` reads the same env independently, since the `knex` CLI doesn't load `src/config.ts`.

Inside Docker Compose, `DB_HOST` is overridden to `db` in `docker-compose.yml`; the `.env` value (`127.0.0.1`) is for running the app directly against a host-installed MySQL.
