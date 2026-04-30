import { ALERT_TYPES } from '../config';

export const postAlertSchema = {
  body: {
    type: 'object',
    required: ['type', 'title', 'body', 'source'],
    additionalProperties: false,
    properties: {
      type: { type: 'string', enum: [...ALERT_TYPES] },
      title: { type: 'string', minLength: 1, maxLength: 200 },
      body: { type: 'string', minLength: 1, maxLength: 4000 },
      source: { type: 'string', minLength: 1, maxLength: 20 },
      metadata: { type: 'object', additionalProperties: true, nullable: true },
      dedupe_key: { type: 'string', maxLength: 120, nullable: true },
    },
  },
} as const;

export const listAlertsSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      type: { type: 'string', enum: [...ALERT_TYPES] },
      unread: { type: 'string', enum: ['0', '1'] },
      limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      before: { type: 'integer', minimum: 1 },
    },
  },
} as const;
