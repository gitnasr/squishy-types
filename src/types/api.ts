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
