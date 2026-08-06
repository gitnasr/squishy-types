import { describe, expect, it } from 'vitest';
import { canonicalizeUrl, parseUrl, urlHash } from '../src/url/canonical.js';

describe('canonicalizeUrl', () => {
  it('folds http into https', () => {
    expect(canonicalizeUrl('http://example.com/a')).toBe('https://example.com/a');
  });

  it('strips www., m. and mobile.', () => {
    expect(canonicalizeUrl('https://www.example.com/a')).toBe('https://example.com/a');
    expect(canonicalizeUrl('https://m.example.com/a')).toBe('https://example.com/a');
    expect(canonicalizeUrl('https://mobile.twitter.com/x')).toBe('https://twitter.com/x');
  });

  it('drops the fragment', () => {
    expect(canonicalizeUrl('https://example.com/a#section-3')).toBe('https://example.com/a');
  });

  it('drops tracking params but keeps meaningful ones', () => {
    expect(canonicalizeUrl('https://example.com/a?utm_source=x&utm_medium=y&id=7')).toBe(
      'https://example.com/a?id=7',
    );
    expect(canonicalizeUrl('https://example.com/a?fbclid=abc&gclid=def')).toBe(
      'https://example.com/a',
    );
    // `ref` is structural on GitHub and `t` is a YouTube timestamp — both survive.
    expect(canonicalizeUrl('https://github.com/x/y?ref=readme')).toBe(
      'https://github.com/x/y?ref=readme',
    );
    expect(canonicalizeUrl('https://youtube.com/watch?v=abc&t=42&si=track')).toBe(
      'https://youtube.com/watch?t=42&v=abc',
    );
  });

  it('sorts remaining params so order stops mattering', () => {
    expect(canonicalizeUrl('https://example.com/a?b=2&a=1')).toBe(
      canonicalizeUrl('https://example.com/a?a=1&b=2'),
    );
  });

  it('drops the trailing slash and the default port', () => {
    expect(canonicalizeUrl('https://example.com/')).toBe('https://example.com');
    expect(canonicalizeUrl('https://example.com/a/')).toBe('https://example.com/a');
    expect(canonicalizeUrl('https://example.com:443/a')).toBe('https://example.com/a');
    expect(canonicalizeUrl('https://example.com:8443/a')).toBe('https://example.com:8443/a');
  });

  it('leaves non-http URLs alone', () => {
    expect(canonicalizeUrl('chrome://extensions')).toBe('chrome://extensions');
    expect(canonicalizeUrl('file:///C:/notes.html')).toBe('file:///C:/notes.html');
    expect(canonicalizeUrl('not a url at all')).toBe('not a url at all');
    expect(canonicalizeUrl('')).toBe('');
  });

  it('is idempotent', () => {
    const once = canonicalizeUrl('http://www.Example.com/a/?utm_source=x#frag');
    expect(canonicalizeUrl(once)).toBe(once);
  });
});

describe('urlHash', () => {
  it('collapses variants of the same page onto one identity', () => {
    const a = urlHash('http://www.example.com/page/?utm_source=newsletter#top');
    const b = urlHash('https://example.com/page');
    expect(a).toBe(b);
  });

  it('keeps genuinely different pages apart', () => {
    expect(urlHash('https://example.com/a')).not.toBe(urlHash('https://example.com/b'));
  });
});

describe('parseUrl', () => {
  it('extracts the domain and path tokens the rule classifier reads', () => {
    const parts = parseUrl('https://github.com/gitnasr/squishy-types/blob/main/README.md');
    expect(parts.domain).toBe('github.com');
    expect(parts.pathTokens).toContain('gitnasr');
    expect(parts.pathTokens).toContain('squishy');
    expect(parts.hash).toHaveLength(64);
  });
});
