import type { EpochMs, IsoDateTime, Uuid } from './common.js';
import type { FlatNode } from './bookmark.js';

export type SyncOpKind = 'create' | 'update' | 'move' | 'remove' | 'reorder';

/**
 * One browser bookmark event, recorded locally before it is ever sent.
 * `localSeq` is monotonic per device and is the idempotency key server-side:
 * `(userId, deviceId, localSeq)` is applied at most once.
 */
export interface SyncChange {
  localSeq: number;
  kind: SyncOpKind;
  chromeId: string;
  parentId: string | null;
  index: number | null;
  title: string | null;
  url: string | null;
  dateAdded: EpochMs | null;
  occurredAt: EpochMs;
}

export interface SyncImportRequest {
  deviceId: Uuid | null;
  deviceLabel: string;
  batchIndex: number;
  batchCount: number;
  nodes: FlatNode[];
}

export interface SyncImportResponse {
  deviceId: Uuid;
  accepted: number;
  deduped: number;
  cursor: number;
}

export interface SyncChangesRequest {
  deviceId: Uuid;
  cursor: number;
  changes: SyncChange[];
}

export interface SyncRejection {
  localSeq: number;
  reason: string;
}

export interface SyncChangesResponse {
  cursor: number;
  applied: number;
  rejected: SyncRejection[];
  /** Plans approved elsewhere (e.g. the web app) that this device must now execute. */
  plans: MutationPlan[];
}

export type MutationOpKind = 'move' | 'rename' | 'create_folder' | 'remove';

/**
 * A single browser write. The server never touches the bookmark tree —
 * it emits these and the extension executes them.
 */
export interface MutationOp {
  opId: Uuid;
  kind: MutationOpKind;
  /** `null` for `create_folder`, which has no node yet. */
  chromeId: string | null;
  targetParentChromeId: string | null;
  index: number | null;
  title: string | null;
}

export interface MutationPlan {
  planId: Uuid;
  proposalId: Uuid;
  createdAt: IsoDateTime;
  ops: MutationOp[];
}

export interface MutationOpResult {
  opId: Uuid;
  ok: boolean;
  error?: string;
  /** Set when the op created a node, so the server can map it back. */
  newChromeId?: string;
}

export interface MutationPlanAck {
  planId: Uuid;
  results: MutationOpResult[];
}

/** Server tree fingerprint vs a fresh `getTree()` — the drift check. */
export interface SyncDiffResponse {
  serverTreeHash: string;
  serverNodeCount: number;
  cursor: number;
}
