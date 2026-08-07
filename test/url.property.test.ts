import { describe, expect, it } from 'vitest';

import { canonicalizeUrl, urlHash } from '../src/url/canonical.js';

/**
 * `urlHash` is the identity function for the whole product.
 *
 * It decides which bookmarks are the same bookmark, on this device and on
 * every other one, forever. The example tests next door pin the rules; these
 * pin the *invariants*, because the failure mode here is not a wrong answer on
 * a URL someone thought of — it is a rule interacting badly with a URL nobody
 * thought of, silently splitting one bookmark into two or merging two into one.
 *
 * Seeded rather than random: a failing corpus has to be re-runnable.
 */
const SEED = Number(process.env.URL_SEED ?? 0xc0ffee);
const CASES = 2000;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(SEED);
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;
const chance = (p: number): boolean => rand() < p;

const SCHEMES = ['http', 'https'] as const;
const SUBDOMAINS = ['', 'www.', 'm.', 'mobile.', 'blog.', 'api.'] as const;
const HOSTS = ['example.com', 'github.com', 'docs.rs', 'a.co.uk', 'xn--80ak6aa92e.com'] as const;
const PORTS = ['', ':80', ':443', ':8080', ':3000'] as const;

/** Deliberately awkward: spaces, unicode, percent-signs, empty segments. */
const SEGMENTS = [
  'a', 'page', 'docs', 'ünïcode', 'with space', 'semi;colon', 'plus+sign', 'percent%25',
  'amp&sand', 'question?mark', 'hash#mark', 'dot.', '..', 'trailing',
] as const;

const TRACKING = [
  'utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid', 'igshid', 'mc_cid',
  'pk_kwd', '_ga', 'si', 'source',
] as const;

const MEANINGFUL = ['id', 'q', 'page', 'ref', 't', 'v', 'lang', 'sort'] as const;

function randomPath(): string {
  const depth = Math.floor(rand() * 4);
  const parts: string[] = [];
  for (let i = 0; i < depth; i++) parts.push(pick(SEGMENTS));
  const path = parts.map((p) => encodeURIComponent(p)).join('/');
  return path === '' ? (chance(0.5) ? '/' : '') : `/${path}${chance(0.3) ? '/' : ''}`;
}

function randomParams(): [string, string][] {
  const out: [string, string][] = [];
  const count = Math.floor(rand() * 5);
  for (let i = 0; i < count; i++) {
    const key = chance(0.5) ? pick(TRACKING) : pick(MEANINGFUL);
    out.push([key, pick(SEGMENTS)]);
  }
  return out;
}

function render(
  scheme: string,
  sub: string,
  host: string,
  port: string,
  path: string,
  params: [string, string][],
  fragment: string,
): string {
  const query =
    params.length > 0
      ? `?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`
      : '';
  return `${scheme}://${sub}${host}${port}${path}${query}${fragment}`;
}

interface Generated {
  url: string;
  scheme: string;
  sub: string;
  host: string;
  port: string;
  path: string;
  params: [string, string][];
  fragment: string;
}

function generate(): Generated {
  const scheme = pick(SCHEMES);
  const sub = pick(SUBDOMAINS);
  const host = pick(HOSTS);
  const port = pick(PORTS);
  const path = randomPath();
  const params = randomParams();
  const fragment = chance(0.4) ? `#${pick(SEGMENTS)}` : '';
  return {
    url: render(scheme, sub, host, port, path, params, fragment),
    scheme,
    sub,
    host,
    port,
    path,
    params,
    fragment,
  };
}

const corpus = Array.from({ length: CASES }, generate);

/** Reports the offending URL rather than just a boolean. */
function forAll(check: (item: Generated) => string | null): void {
  const failures: string[] = [];
  for (const item of corpus) {
    const failure = check(item);
    if (failure) failures.push(`${item.url}\n    ${failure}`);
    if (failures.length >= 5) break;
  }
  if (failures.length > 0) {
    throw new Error(`seed ${SEED} — ${failures.length} counterexample(s):\n  ${failures.join('\n  ')}`);
  }
}

describe('canonicalizeUrl invariants', () => {
  /**
   * The one that matters most.
   *
   * The API stores the canonical form and re-canonicalises on the way back in.
   * If a URL moved on the second pass, its identity would depend on how many
   * times it had been through the pipeline — dedupe would fail intermittently
   * and drift would be unexplainable.
   */
  it('is idempotent', () => {
    forAll((item) => {
      const once = canonicalizeUrl(item.url);
      const twice = canonicalizeUrl(once);
      return once === twice ? null : `once=${once} twice=${twice}`;
    });
  });

  it('never leaks a fragment, a tracking param, http, or a trailing slash', () => {
    forAll((item) => {
      const canonical = canonicalizeUrl(item.url);
      if (canonical.includes('#')) return `fragment survived: ${canonical}`;
      if (/[?&](utm_|pk_|mc_|fbclid|gclid|igshid|_ga)/.test(canonical)) {
        return `tracking param survived: ${canonical}`;
      }
      if (canonical.startsWith('http://')) return `http not folded: ${canonical}`;
      if (canonical.endsWith('/')) return `trailing slash survived: ${canonical}`;
      return null;
    });
  });

  /** Query order is not meaning. Two links to the same page must agree. */
  it('is invariant under parameter reordering', () => {
    forAll((item) => {
      if (item.params.length < 2) return null;
      const shuffled = [...item.params].reverse();
      const other = render(
        item.scheme,
        item.sub,
        item.host,
        item.port,
        item.path,
        shuffled,
        item.fragment,
      );
      const a = canonicalizeUrl(item.url);
      const b = canonicalizeUrl(other);
      return a === b ? null : `${a} !== ${b}`;
    });
  });

  /**
   * A shared link and a clean one are the same bookmark.
   *
   * This is the property that makes the report's duplicate detection honest —
   * without it, every newsletter link is its own bookmark forever.
   */
  it('ignores added tracking parameters, scheme, and www', () => {
    forAll((item) => {
      const decorated = render(
        'http',
        item.sub === '' ? 'www.' : item.sub,
        item.host,
        item.port === ':443' ? '' : item.port,
        item.path,
        [...item.params, ['utm_source', 'newsletter'], ['fbclid', 'xyz123']],
        '#somewhere',
      );
      const a = urlHash(item.url);
      const b = urlHash(decorated);
      // `www.` is stripped, so a bare host and a www host converge — but `m.`
      // and `blog.` are different sites and must not be forced together.
      if (item.sub !== '' && item.sub !== 'www.') return null;
      if (item.port === ':80' || item.port === ':443') return null;
      return a === b ? null : `${canonicalizeUrl(item.url)} !== ${canonicalizeUrl(decorated)}`;
    });
  });

  /** Distinct canonical forms must never share a hash, and vice versa. */
  it('hashes canonical forms one-to-one', () => {
    const byHash = new Map<string, string>();
    for (const item of corpus) {
      const canonical = canonicalizeUrl(item.url);
      const hash = urlHash(item.url);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      const seen = byHash.get(hash);
      if (seen !== undefined && seen !== canonical) {
        throw new Error(`hash collision on seed ${SEED}: "${seen}" and "${canonical}"`);
      }
      byHash.set(hash, canonical);
    }
  });

  /** A canonical http(s) URL has to survive being parsed again. */
  it('produces re-parseable output', () => {
    forAll((item) => {
      const canonical = canonicalizeUrl(item.url);
      try {
        new URL(canonical);
        return null;
      } catch {
        return `not a URL: ${canonical}`;
      }
    });
  });

  /** Different paths are different bookmarks, however decorated. */
  it('keeps distinct paths distinct', () => {
    forAll((item) => {
      const other = render(
        item.scheme,
        item.sub,
        item.host,
        item.port,
        `${item.path === '' ? '' : item.path}/definitely-different-${item.host.length}`,
        item.params,
        item.fragment,
      );
      return urlHash(item.url) === urlHash(other) ? `collided with ${other}` : null;
    });
  });
});
