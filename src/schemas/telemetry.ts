import { z } from 'zod';
import { epochMsSchema } from './common.js';

/**
 * The closed sets behind client telemetry.
 *
 * These are the actual defence on an unauthenticated write path. Validation
 * here decides what can become a metric label, and therefore bounds how many
 * time series a hostile client can create — which is the only attack that
 * matters against a metrics ingest.
 */

/** A batch larger than this is a client bug or an attack. Neither deserves service. */
export const MAX_TELEMETRY_EVENTS = 200;

export const telemetryEventNames = [
  'popup.opened',
  'report.generated',
  'report.cta_clicked',
  'report.history_permission',
  'extension.installed',
  'extension.updated',
  'sync.imported',
  'sync.flushed',
  'sync.rejected',
  'sync.drift',
  'sync.flush_failed',
] as const;

/**
 * Allowed label values, per label.
 *
 * Booleans arrive as real booleans and are stringified server-side; the string
 * forms are listed so the check is one lookup either way.
 */
export const telemetryLabelValues = {
  size: ['0', '1-99', '100-499', '500-999', '1k-5k', '5k+'],
  issues: ['0', '1-9', '10-49', '50-199', '200+'],
  signedIn: ['true', 'false'],
  granted: ['true', 'false'],
  historyAvailable: ['true', 'false'],
} as const;

export const telemetryMeasures = [
  'durationMs',
  'duplicates',
  'emptyFolders',
  'singleItemFolders',
  'maxDepth',
  'nodes',
  'batches',
  'sent',
  'applied',
  'count',
  'pruned',
] as const;

export const telemetryEventNameSchema = z.enum(telemetryEventNames);

export const telemetryClientSchema = z.enum(['extension', 'web']);

/**
 * Note the loose `name`: an unknown event is **dropped, not rejected**.
 *
 * A newer extension emitting an event this API has not heard of must not have
 * its whole batch refused — the other events in it are still true, and users
 * sit on stale builds for weeks in both directions.
 */
export const telemetryEventSchema = z.object({
  name: z.string().min(1).max(64),
  attributes: z.record(
    z.string().max(40),
    z.union([z.number(), z.string().max(64), z.boolean()]),
  ),
  at: epochMsSchema,
});

export const telemetryBatchSchema = z.object({
  client: telemetryClientSchema,
  events: z.array(telemetryEventSchema).max(MAX_TELEMETRY_EVENTS),
});

export const telemetryIngestResponseSchema = z.object({
  accepted: z.number().int().nonnegative(),
  dropped: z.number().int().nonnegative(),
});
