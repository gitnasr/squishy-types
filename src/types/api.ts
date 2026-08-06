import type { ClientKind, KeySource, Plan, Uuid } from './common.js';

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

export interface AuthGoogleRequest {
  /** Google-issued `id_token`; verified server-side, never trusted as-is. */
  idToken: string;
  client: ClientKind;
  deviceLabel?: string;
}

export interface AuthTokens {
  accessToken: string;
  /** Rotating. Stored hashed server-side; the plaintext is shown exactly once. */
  refreshToken: string;
  /** Access-token lifetime in seconds. */
  expiresIn: number;
}

export interface AuthResponse {
  tokens: AuthTokens;
  user: MeResponse;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  /** Present on 426 so the client can tell the user exactly what to update. */
  minProtocolVersion?: number;
}
