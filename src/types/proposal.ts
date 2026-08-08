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

/**
 * The review queue, shaped for display.
 *
 * `Proposal` alone cannot render a diff — it has counts, not the bookmark
 * titles or destinations a user needs to judge the change. This is the read
 * model for that screen, assembled server-side so the client makes one request
 * rather than N+1.
 */
export interface ReviewItem {
  proposalId: Uuid;
  bookmarkId: Uuid;
  title: string;
  url: string;
  /** Where it lives now. `null` means loose at the top level. */
  currentFolder: string | null;
  /** Where the proposal would put it. */
  targetCategory: string;
  confidence: number;
  rationale: string;
}

/**
 * Proposals grouped by destination, not by bookmark.
 *
 * Grouping is what makes bulk approval possible: a user judges "these 40 belong
 * in Development" once, rather than answering the same question 40 times.
 */
export interface ReviewGroup {
  kind: ProposalKind;
  targetCategory: string;
  /** Mean confidence across the group, for sorting the shakiest to the top. */
  confidence: number;
  items: ReviewItem[];
}

export interface ReviewQueueResponse {
  groups: ReviewGroup[];
  total: number;
}

/**
 * An applied batch that can still be reversed.
 *
 * Undo is what makes approving two hundred changes at once reasonable rather
 * than reckless, so it has to be reachable — a safety net nobody can find is
 * not a safety net.
 */
export interface UndoableChange {
  id: Uuid;
  appliedAt: IsoDateTime;
  /** How many browser operations reversing it would perform. */
  ops: number;
}
