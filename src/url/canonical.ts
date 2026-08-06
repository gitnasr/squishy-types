import type { UrlParts } from '../types/index.js';
import { sha256Hex } from './sha256.js';

/**
 * Params dropped wholesale. Deliberately conservative: `ref` stays (GitHub uses
 * it structurally) and `t` stays (YouTube timestamps). Stripping a meaningful
 * param merges two distinct bookmarks, which is worse than missing a dupe.
 */
const TRACKING_PARAMS = new Set([
  'gclid', 'gclsrc', 'gbraid', 'wbraid', 'dclid', 'fbclid', 'msclkid', 'yclid', 'twclid',
  'ttclid', 'igshid', 'igsh', 'si', 'spm', 'scm', 'ref_src', 'ref_url', 'mkt_tok', 'trk',
  'ncid', 'cmpid', 'icid', 'epik', 's_kwcid', 'li_fat_id', 'oly_enc_id', 'oly_anon_id',
  '_ga', '_gl', '_hsenc', '_hsmi', 'wt_mc', 'at_medium', 'at_campaign', 'campaignid',
  'adgroupid', 'sc_cid', 'source',
]);

const TRACKING_PREFIXES = ['utm_', 'pk_', 'piwik_', 'mc_', 'vero_', 'hsa_', 'ga_'];

const STRIPPABLE_SUBDOMAINS = ['www.', 'm.', 'mobile.'];

const DEFAULT_PORTS: Record<string, string> = { 'http:': '80', 'https:': '443' };

function isTrackingParam(key: string): boolean {
  const lower = key.toLowerCase();
  if (TRACKING_PARAMS.has(lower)) return true;
  return TRACKING_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

export function stripSubdomain(hostname: string): string {
  const lower = hostname.toLowerCase();
  for (const prefix of STRIPPABLE_SUBDOMAINS) {
    if (lower.startsWith(prefix) && lower.length > prefix.length) {
      return lower.slice(prefix.length);
    }
  }
  return lower;
}

/**
 * Normalised form used for dedupe and hashing.
 *
 * - `http` is folded into `https` (the same page, not two bookmarks)
 * - `www.` / `m.` / `mobile.` stripped, host lowercased, default port dropped
 * - fragment dropped, tracking params dropped, remaining params sorted
 * - trailing slash dropped
 *
 * Non-HTTP URLs (`chrome://`, `file://`, `javascript:`) are returned trimmed
 * and otherwise untouched — normalising them has no meaning.
 */
export function canonicalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === '') return '';

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return trimmed;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return trimmed;
  }

  const host = stripSubdomain(url.hostname);
  const port = url.port && url.port !== DEFAULT_PORTS[url.protocol] ? `:${url.port}` : '';

  const params: [string, string][] = [];
  url.searchParams.forEach((value, key) => {
    if (!isTrackingParam(key)) params.push([key, value]);
  });
  params.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));

  const search = params.length > 0
    ? `?${params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`
    : '';

  let path = url.pathname;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  if (path === '/') path = '';

  return `https://${host}${port}${path}${search}`;
}

/** sha256 of the canonical form. The cross-device identity key. */
export function urlHash(raw: string): string {
  return sha256Hex(canonicalizeUrl(raw));
}

/** Path segments split on `/`, `-` and `_` — the cheap signal the rule-based classifier reads. */
export function pathTokens(pathname: string): string[] {
  return pathname
    .toLowerCase()
    .split(/[/\-_.]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !/^\d+$/.test(token));
}

export function parseUrl(raw: string): UrlParts {
  const canonical = canonicalizeUrl(raw);
  let host = '';
  let tokens: string[] = [];

  try {
    const url = new URL(canonical);
    host = url.hostname;
    tokens = pathTokens(url.pathname);
  } catch {
    host = '';
  }

  return {
    original: raw,
    canonical,
    hash: sha256Hex(canonical),
    host,
    domain: stripSubdomain(host),
    pathTokens: tokens,
  };
}
