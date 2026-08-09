import type { KeySource, Plan, Uuid } from './common.js';

export interface QuotaState {
  /** Month bucket, `YYYY-MM-01`. */
  period: string;
  limit: number;
  used: number;
  remaining: number;
  /** `byok` users are unmetered; the UI says so explicitly. */
  keySource: KeySource;
}

export interface MeResponse {
  /**
   * Where the web app lives, told to clients rather than compiled into them.
   *
   * The extension needs this to send someone to the review queue. Baking it in
   * at build time meant a forgotten env var silently pointed users at
   * localhost — and changing the domain would have required shipping a new
   * extension through Web Store review.
   */
  webAppUrl: string;
  userId: Uuid;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  plan: Plan;
  byokEnabled: boolean;
  quota: QuotaState;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  /** Present on 426 so the client can tell the user exactly what to update. */
  minProtocolVersion?: number;
}

/**
 * The web dashboard.
 *
 * Built from the server's mirror using the same `buildCleanupReport` the
 * extension runs locally, so the two never disagree about how many duplicates
 * a user has. The extension's copy works offline and signed out; this one works
 * on any device.
 */
export interface DashboardResponse {
  bookmarks: number;
  folders: number;
  maxDepth: number;
  duplicates: number;
  emptyFolders: number;
  singleItemFolders: number;
  untitled: number;
  /** The number behind the "fix these" call to action. */
  issueCount: number;
  /** Proposals waiting in the review queue. */
  pendingProposals: number;
  /** ISO timestamp of the last sync from any device, or null if never. */
  lastSyncAt: string | null;
  deviceCount: number;
}
