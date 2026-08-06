import { z } from 'zod';
import { keySourceSchema, planSchema, uuidSchema } from './common.js';

export const quotaStateSchema = z.object({
  period: z.string(),
  limit: z.number().int().nonnegative(),
  used: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  keySource: keySourceSchema,
});

export const meResponseSchema = z.object({
  userId: uuidSchema,
  email: z.string().email(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  plan: planSchema,
  byokEnabled: z.boolean(),
  quota: quotaStateSchema,
});

export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  error: z.string(),
  message: z.string(),
  minProtocolVersion: z.number().int().optional(),
});
