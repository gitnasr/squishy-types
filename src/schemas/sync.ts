import { z } from 'zod';
import { epochMsSchema, isoDateTimeSchema, uuidSchema } from './common.js';
import { flatNodeSchema } from './bookmark.js';

export const IMPORT_BATCH_SIZE = 500;
export const MAX_CHANGES_PER_FLUSH = 1000;

export const syncOpKindSchema = z.enum(['create', 'update', 'move', 'remove', 'reorder']);

export const syncChangeSchema = z.object({
  localSeq: z.number().int().nonnegative(),
  kind: syncOpKindSchema,
  chromeId: z.string().min(1).max(128),
  parentId: z.string().min(1).max(128).nullable(),
  index: z.number().int().min(0).nullable(),
  title: z.string().max(2048).nullable(),
  url: z.string().max(4096).nullable(),
  dateAdded: epochMsSchema.nullable(),
  occurredAt: epochMsSchema,
});

export const syncImportRequestSchema = z.object({
  deviceId: uuidSchema.nullable(),
  deviceLabel: z.string().min(1).max(120),
  batchIndex: z.number().int().min(0),
  batchCount: z.number().int().min(1),
  nodes: z.array(flatNodeSchema).max(IMPORT_BATCH_SIZE),
});

export const syncImportResponseSchema = z.object({
  deviceId: uuidSchema,
  accepted: z.number().int().nonnegative(),
  deduped: z.number().int().nonnegative(),
  cursor: z.number().int().nonnegative(),
});

export const syncChangesRequestSchema = z.object({
  deviceId: uuidSchema,
  cursor: z.number().int().nonnegative(),
  changes: z.array(syncChangeSchema).max(MAX_CHANGES_PER_FLUSH),
});

export const syncRejectionSchema = z.object({
  localSeq: z.number().int().nonnegative(),
  reason: z.string(),
});

export const mutationOpKindSchema = z.enum(['move', 'rename', 'create_folder', 'remove']);

export const mutationOpSchema = z.object({
  opId: uuidSchema,
  kind: mutationOpKindSchema,
  chromeId: z.string().min(1).max(128).nullable(),
  targetParentChromeId: z.string().min(1).max(128).nullable(),
  index: z.number().int().min(0).nullable(),
  title: z.string().max(2048).nullable(),
});

export const mutationPlanSchema = z.object({
  planId: uuidSchema,
  proposalId: uuidSchema,
  createdAt: isoDateTimeSchema,
  ops: z.array(mutationOpSchema),
});

export const syncChangesResponseSchema = z.object({
  cursor: z.number().int().nonnegative(),
  applied: z.number().int().nonnegative(),
  rejected: z.array(syncRejectionSchema),
  plans: z.array(mutationPlanSchema),
});

export const mutationOpResultSchema = z.object({
  opId: uuidSchema,
  ok: z.boolean(),
  error: z.string().optional(),
  newChromeId: z.string().max(128).optional(),
});

export const mutationPlanAckSchema = z.object({
  planId: uuidSchema,
  results: z.array(mutationOpResultSchema),
});

export const syncDiffResponseSchema = z.object({
  serverTreeHash: z.string(),
  serverNodeCount: z.number().int().nonnegative(),
  cursor: z.number().int().nonnegative(),
});
