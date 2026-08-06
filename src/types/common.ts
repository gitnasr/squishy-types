/** UUID v4, string-encoded. Server-generated. */
export type Uuid = string;

/** ISO-8601 timestamp, e.g. `2026-08-06T12:00:00.000Z`. */
export type IsoDateTime = string;

/** Milliseconds since epoch. Browser APIs hand us these, so they stay numeric. */
export type EpochMs = number;

export type Plan = 'free' | 'pro';

/** Which credential paid for an AI call. Drives the usage ledger. */
export type KeySource = 'platform' | 'byok';

/** Which client is talking to the API. Sent alongside the protocol version. */
export type ClientKind = 'extension' | 'web';

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
