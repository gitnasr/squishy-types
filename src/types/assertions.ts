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
  apiErrorSchema,
  flatNodeSchema,
  meResponseSchema,
  mutationOpSchema,
  mutationPlanAckSchema,
  mutationPlanSchema,
  proposalBulkApproveRequestSchema,
  proposalDecisionResponseSchema,
  telemetryBatchSchema,
  telemetryEventNameSchema,
  telemetryEventSchema,
  telemetryIngestResponseSchema,
  proposalItemSchema,
  proposalSchema,
  quotaStateSchema,
  syncChangeSchema,
  syncChangesRequestSchema,
  syncChangesResponseSchema,
  syncDiffResponseSchema,
  syncImportRequestSchema,
  syncImportResponseSchema,
} from '../schemas/index.js';

import type {
  ApiError,
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
  SyncChange,
  SyncChangesRequest,
  SyncChangesResponse,
  SyncDiffResponse,
  SyncImportRequest,
  SyncImportResponse,
  TelemetryBatch,
  TelemetryEvent,
  TelemetryEventName,
  TelemetryIngestResponse,
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
type _ApiError = Expect<Mutual<z.infer<typeof apiErrorSchema>, ApiError>>;

type _ProposalItem = Expect<Mutual<z.infer<typeof proposalItemSchema>, ProposalItem>>;
type _Proposal = Expect<Mutual<z.infer<typeof proposalSchema>, Proposal>>;
type _ProposalBulkApprove = Expect<
  Mutual<z.infer<typeof proposalBulkApproveRequestSchema>, ProposalBulkApproveRequest>
>;
type _ProposalDecision = Expect<
  Mutual<z.infer<typeof proposalDecisionResponseSchema>, ProposalDecisionResponse>
>;

/**
 * The telemetry allowlist is the whole defence on an unauthenticated write
 * path, so a schema that drifts from its type is a security bug, not a typo.
 */
type _TelemetryEventName = Expect<
  Mutual<z.infer<typeof telemetryEventNameSchema>, TelemetryEventName>
>;
type _TelemetryEvent = Expect<Mutual<z.infer<typeof telemetryEventSchema>, TelemetryEvent>>;
type _TelemetryBatch = Expect<Mutual<z.infer<typeof telemetryBatchSchema>, TelemetryBatch>>;
type _TelemetryIngest = Expect<
  Mutual<z.infer<typeof telemetryIngestResponseSchema>, TelemetryIngestResponse>
>;

export type {
  _TelemetryEventName,
  _TelemetryEvent,
  _TelemetryBatch,
  _TelemetryIngest,
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
  _ApiError,
  _ProposalItem,
  _Proposal,
  _ProposalBulkApprove,
  _ProposalDecision,
};
