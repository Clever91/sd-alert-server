export const registerDeviceSchema = {
  body: {
    type: 'object',
    required: ['fcmToken', 'platform'],
    additionalProperties: false,
    properties: {
      fcmToken: { type: 'string', minLength: 10, maxLength: 255 },
      platform: { type: 'string', enum: ['android', 'ios'] },
      deviceName: { type: 'string', maxLength: 120 },
      userLabel: { type: 'string', maxLength: 120 },
    },
  },
} as const;
