import type { IsoDateTime, Uuid } from './common.js';

export type ProposalKind = 'categorize' | 'dedupe' | 'merge_folder' | 'dead_link';

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'applied' | 'expired';

export type ProposalItemOp = 'move' | 'rename' | 'delete' | 'create_folder' | 'merge';

export interface ProposalItem {
  id: Uuid;
  proposalId: Uuid;
  bookmarkId: Uuid | null;
  folderId: Uuid | null;
  op: ProposalItemOp;
  /** Inverse payload — replayed to undo. */
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export interface Proposal {
  id: Uuid;
  userId: Uuid;
  kind: ProposalKind;
  status: ProposalStatus;
  confidence: number;
  /** Short human-readable "why". Shown verbatim in the review queue. */
  rationale: string;
  /** Groups everything produced by one cleanup run. */
  batchId: Uuid;
  itemCount: number;
  createdAt: IsoDateTime;
  items?: ProposalItem[];
}

export interface AppliedChange {
  id: Uuid;
  userId: Uuid;
  proposalId: Uuid;
  appliedAt: IsoDateTime;
  inversePlan: Record<string, unknown>;
  undoneAt: IsoDateTime | null;
}

export interface ProposalBulkApproveRequest {
  proposalIds: Uuid[];
  /** Optional per-proposal destination override from "Edit destination". */
  overrides?: Record<Uuid, string>;
}

export interface ProposalDecisionResponse {
  approved: number;
  rejected: number;
  planIds: Uuid[];
}
