import type { EpochMs } from './common.js';

/**
 * Client telemetry.
 *
 * The extension cannot export to Alloy directly. Alloy requires basic auth, and
 * an extension ships to users' machines — any credential compiled into it is
 * public the moment someone unzips the `.crx`. So events travel to the API,
 * which holds the credential server-side and re-emits them.
 *
 * That makes the ingest endpoint an **unauthenticated write path**, because the
 * activation funnel is mostly pre-sign-in and gating it would measure only the
 * users who already converted. The protection is not authentication but shape:
 * event names and attribute values come from closed sets, and the server drops
 * anything outside them. Nothing a client sends can become a new metric label,
 * so nothing a client sends can inflate cardinality.
 */

export type TelemetryEventName =
  | 'popup.opened'
  | 'report.generated'
  | 'report.cta_clicked'
  | 'report.history_permission'
  | 'extension.installed'
  | 'extension.updated'
  | 'sync.imported'
  | 'sync.flushed'
  | 'sync.rejected'
  | 'sync.drift'
  | 'sync.flush_failed';

/**
 * Attributes allowed to become metric labels.
 *
 * A label whose values come from the client is a cardinality bomb: one attacker
 * sending a million distinct values creates a million time series, and Mimir
 * does not forget them quickly. So every one of these is a small closed set.
 */
export type TelemetryLabel =
  | 'size'
  | 'issues'
  | 'signedIn'
  | 'granted'
  | 'historyAvailable';

/**
 * Numeric attributes recorded as measurements rather than labels.
 *
 * A count belongs in a histogram, never in a label — `duplicates=417` as a
 * label is a unique time series per user.
 */
export type TelemetryMeasure =
  | 'durationMs'
  | 'duplicates'
  | 'emptyFolders'
  | 'singleItemFolders'
  | 'maxDepth'
  | 'nodes'
  | 'batches'
  | 'sent'
  | 'applied'
  | 'count'
  | 'pruned';

export type TelemetryClient = 'extension' | 'web';

export interface TelemetryEvent {
  name: string;
  /** Counts and buckets only — never a URL, title, or anything user-authored. */
  attributes: Record<string, number | string | boolean>;
  at: EpochMs;
}

export interface TelemetryBatch {
  /** Which client sent this. Not a user id — there may not be a user. */
  client: TelemetryClient;
  events: TelemetryEvent[];
}

export interface TelemetryIngestResponse {
  /** Events that matched the allowlist and were re-emitted. */
  accepted: number;
  /** Events dropped for an unknown name. Surfaced so drift is visible. */
  dropped: number;
}
