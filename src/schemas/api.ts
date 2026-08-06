import { z } from 'zod';
import { clientKindSchema, keySourceSchema, planSchema, uuidSchema } from './common.js';

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

export const authGoogleRequestSchema = z.object({
  idToken: z.string().min(1).max(8192),
  client: clientKindSchema,
  deviceLabel: z.string().min(1).max(120).optional(),
});

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
});

export const authResponseSchema = z.object({
  tokens: authTokensSchema,
  user: meResponseSchema,
});

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});

export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  error: z.string(),
  message: z.string(),
  minProtocolVersion: z.number().int().optional(),
});
