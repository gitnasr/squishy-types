/**
 * Wire protocol version.
 *
 * Extension users sit on stale builds for weeks, so the version travels in a
 * header on every request and the API refuses anything below its floor with
 * `426 Upgrade Required`. Bump this on any breaking change to the sync or
 * proposal contracts, and tag the package major at the same time.
 */
export const PROTOCOL_VERSION = 1;

/** Oldest client version the API still serves. Keep N-1 alive for one extension release cycle. */
export const MIN_SUPPORTED_PROTOCOL = 1;

export const PROTOCOL_HEADER = 'x-squishy-protocol';

export const CLIENT_HEADER = 'x-squishy-client';

export function isProtocolSupported(version: number): boolean {
  return Number.isInteger(version) && version >= MIN_SUPPORTED_PROTOCOL && version <= PROTOCOL_VERSION;
}
