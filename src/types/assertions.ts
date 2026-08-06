/**
 * Compile-time drift guard.
 *
 * Types are declared by hand in `src/types/`; Zod schemas are declared in
 * `src/schemas/`. Either one can be edited without the other, so every wire
 * contract is pinned here: if a schema and its type stop agreeing in either
 * direction, `pnpm typecheck` fails. Nothing is exported — this file exists
 * purely to be type-checked.
 */
import { z } from 'zod';

import type {
  authGoogleRequestSchema,
  authResponseSchema,
  authTokensSchema,
  apiErrorSchema,
  flatNodeSchema,
  meResponseSchema,
  mutationOpSchema,
  mutationPlanAckSchema,
  mutationPlanSchema,
  proposalBulkApproveRequestSchema,
  proposalDecisionResponseSchema,
  proposalItemSchema,
  proposalSchema,
  quotaStateSchema,
  refreshRequestSchema,
  syncChangeSchema,
  syncChangesRequestSchema,
  syncChangesResponseSchema,
  syncDiffResponseSchema,
  syncImportRequestSchema,
  syncImportResponseSchema,
} from '../schemas/index.js';

import type {
  ApiError,
  AuthGoogleRequest,
  AuthResponse,
  AuthTokens,
  FlatNode,
  MeResponse,
  MutationOp,
  MutationPlan,
  MutationPlanAck,
  Proposal,
  ProposalBulkApproveRequest,
  ProposalDecisionResponse,
  ProposalItem,
  QuotaState,
  RefreshRequest,
  SyncChange,
  SyncChangesRequest,
  SyncChangesResponse,
  SyncDiffResponse,
  SyncImportRequest,
  SyncImportResponse,
} from './index.js';

/** `false` when the two types are not mutually assignable. */
type Mutual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** Fails to compile when handed `false`. */
type Expect<T extends true> = T;

type _FlatNode = Expect<Mutual<z.infer<typeof flatNodeSchema>, FlatNode>>;

type _SyncChange = Expect<Mutual<z.infer<typeof syncChangeSchema>, SyncChange>>;
type _SyncImportRequest = Expect<Mutual<z.infer<typeof syncImportRequestSchema>, SyncImportRequest>>;
type _SyncImportResponse = Expect<
  Mutual<z.infer<typeof syncImportResponseSchema>, SyncImportResponse>
>;
type _SyncChangesRequest = Expect<
  Mutual<z.infer<typeof syncChangesRequestSchema>, SyncChangesRequest>
>;
type _SyncChangesResponse = Expect<
  Mutual<z.infer<typeof syncChangesResponseSchema>, SyncChangesResponse>
>;
type _SyncDiffResponse = Expect<Mutual<z.infer<typeof syncDiffResponseSchema>, SyncDiffResponse>>;
type _MutationOp = Expect<Mutual<z.infer<typeof mutationOpSchema>, MutationOp>>;
type _MutationPlan = Expect<Mutual<z.infer<typeof mutationPlanSchema>, MutationPlan>>;
type _MutationPlanAck = Expect<Mutual<z.infer<typeof mutationPlanAckSchema>, MutationPlanAck>>;

type _QuotaState = Expect<Mutual<z.infer<typeof quotaStateSchema>, QuotaState>>;
type _MeResponse = Expect<Mutual<z.infer<typeof meResponseSchema>, MeResponse>>;
type _AuthGoogleRequest = Expect<
  Mutual<z.infer<typeof authGoogleRequestSchema>, AuthGoogleRequest>
>;
type _AuthTokens = Expect<Mutual<z.infer<typeof authTokensSchema>, AuthTokens>>;
type _AuthResponse = Expect<Mutual<z.infer<typeof authResponseSchema>, AuthResponse>>;
type _RefreshRequest = Expect<Mutual<z.infer<typeof refreshRequestSchema>, RefreshRequest>>;
type _ApiError = Expect<Mutual<z.infer<typeof apiErrorSchema>, ApiError>>;

type _ProposalItem = Expect<Mutual<z.infer<typeof proposalItemSchema>, ProposalItem>>;
type _Proposal = Expect<Mutual<z.infer<typeof proposalSchema>, Proposal>>;
type _ProposalBulkApprove = Expect<
  Mutual<z.infer<typeof proposalBulkApproveRequestSchema>, ProposalBulkApproveRequest>
>;
type _ProposalDecision = Expect<
  Mutual<z.infer<typeof proposalDecisionResponseSchema>, ProposalDecisionResponse>
>;

export type {
  _FlatNode,
  _SyncChange,
  _SyncImportRequest,
  _SyncImportResponse,
  _SyncChangesRequest,
  _SyncChangesResponse,
  _SyncDiffResponse,
  _MutationOp,
  _MutationPlan,
  _MutationPlanAck,
  _QuotaState,
  _MeResponse,
  _AuthGoogleRequest,
  _AuthTokens,
  _AuthResponse,
  _RefreshRequest,
  _ApiError,
  _ProposalItem,
  _Proposal,
  _ProposalBulkApprove,
  _ProposalDecision,
};
