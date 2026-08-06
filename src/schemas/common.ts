import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Regex rather than `z.uuid()` so the schema behaves identically across zod minors. */
export const uuidSchema = z.string().regex(UUID_RE, 'must be a UUID');

export const isoDateTimeSchema = z.string().min(1);

export const epochMsSchema = z.number().int().nonnegative();

export const planSchema = z.enum(['free', 'pro']);

export const keySourceSchema = z.enum(['platform', 'byok']);

export const clientKindSchema = z.enum(['extension', 'web']);

export const jsonObjectSchema = z.record(z.string(), z.unknown());
