import { z } from 'zod';
import { isoDateTimeSchema, jsonObjectSchema, uuidSchema } from './common.js';

export const proposalKindSchema = z.enum(['categorize', 'dedupe', 'merge_folder', 'dead_link']);

export const proposalStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'applied',
  'expired',
]);

export const proposalItemOpSchema = z.enum([
  'move',
  'rename',
  'delete',
  'create_folder',
  'merge',
]);

export const proposalItemSchema = z.object({
  id: uuidSchema,
  proposalId: uuidSchema,
  bookmarkId: uuidSchema.nullable(),
  folderId: uuidSchema.nullable(),
  op: proposalItemOpSchema,
  before: jsonObjectSchema,
  after: jsonObjectSchema,
});

export const proposalSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  kind: proposalKindSchema,
  status: proposalStatusSchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  batchId: uuidSchema,
  itemCount: z.number().int().nonnegative(),
  createdAt: isoDateTimeSchema,
  items: z.array(proposalItemSchema).optional(),
});

export const proposalBulkApproveRequestSchema = z.object({
  proposalIds: z.array(uuidSchema).min(1).max(1000),
  overrides: z.record(uuidSchema, z.string()).optional(),
});

export const proposalDecisionResponseSchema = z.object({
  approved: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  planIds: z.array(uuidSchema),
});
