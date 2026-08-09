import { describe, expect, it } from 'vitest';

import {
  RULE_CONFIDENCE_FLOOR,
  classifyByRule,
  hasUsableSignal,
  runRulePass,
} from '../src/classify/rules.js';
import type { ClassifiableBookmark } from '../src/types/index.js';

/**
 * The rule pass decides what categorisation costs.
 *
 * Every bookmark it answers is one the LLM never sees, and — because rule
 * results do not draw quota — one that does not spend a free user's 20 URLs.
 * So the tests that matter are about what it *declines* to answer: a confident
 * wrong answer is worse than an honest deferral, because the deferral costs
 * money and the wrong answer costs trust.
 */
const at = (url: string, title = 'Untitled'): ClassifiableBookmark => ({ id: url, url, title });

describe('classifyByRule', () => {
  it('classifies unambiguous domains', () => {
    expect(classifyByRule(at('https://github.com/gitnasr/squishy'))?.category).toBe('Development');
    expect(classifyByRule(at('https://arxiv.org/abs/1706.03762'))?.category).toBe(
      'Research & Papers',
    );
    expect(classifyByRule(at('https://figma.com/file/abc'))?.category).toBe('Design & UI');
    expect(classifyByRule(at('https://kubernetes.io/docs/home/'))?.category).toBe(
      'DevOps & Infra',
    );
  });

  it('follows a domain down to its subdomains', () => {
    // `gist.github.com` is github; the rule is a suffix match on a label
    // boundary so it inherits without needing its own entry.
    expect(classifyByRule(at('https://gist.github.com/x/y'))?.category).toBe('Development');
  });

  it('does not match a domain that merely ends in the same letters', () => {
    // `nongithub.com` is not github. Substring matching would have said it was.
    expect(classifyByRule(at('https://nongithub.com/a'))).toBeNull();
  });

  it('survives canonicalisation quirks', () => {
    // The rules read the canonical host, so `www.`, `m.` and http are already
    // handled — the same normalisation the API dedupes with.
    expect(classifyByRule(at('http://www.github.com/a/b'))?.category).toBe('Development');
    expect(classifyByRule(at('https://m.leetcode.com/problems/x'))?.category).toBe('Development');
  });

  /**
   * The trap this list exists to avoid.
   *
   * `medium.com` is roughly half engineering and half everything else. A domain
   * rule for it would misfile a large minority silently and confidently, at
   * scale, for free — which is the worst combination available.
   */
  it('declines on domains that host too many kinds of thing', () => {
    for (const url of [
      // Platforms, not subjects: a LangGraph course and a music video are both
      // youtube.com. Filing by host put a machine-learning tutorial in
      // "Entertainment" for a real user.
      'https://youtube.com/watch?v=abc',
      'https://reddit.com/r/StableDiffusion/comments/x',
      'https://medium.com/@someone/a-post',
      'https://dev.to/someone/a-post',
      'https://en.wikipedia.org/wiki/Bookmark',
      'https://docs.google.com/document/d/abc',
      'https://substack.com/p/thing',
    ]) {
      expect(classifyByRule(at(url)), url).toBeNull();
    }
  });

  it('does not let a path rule rescue an ambiguous host', () => {
    // `/blog/` is an article path, but on medium.com the path is exactly what
    // makes the host ambiguous — the rule must not talk itself back into an
    // answer it already declined.
    expect(classifyByRule(at('https://medium.com/blog/a-post'))).toBeNull();
  });

  it('uses path shape where the host alone is not enough', () => {
    const docs = classifyByRule(at('https://example.com/docs/getting-started'));
    expect(docs?.category).toBe('Documentation & Reference');
    expect(docs?.confidence).toBeGreaterThanOrEqual(RULE_CONFIDENCE_FLOOR);
  });

  /**
   * A product page is shopping whatever the product is.
   *
   * Two DJI gimbals from the manufacturer's own store were filed under "Tools
   * & Utilities" by the model, which judged the object instead of the page.
   * Someone on store.dji.com is shopping.
   */
  it('reads storefront subdomains and product paths as shopping', () => {
    expect(classifyByRule(at('https://store.dji.com/product/osmo-mobile-8p'))?.category).toBe(
      'Shopping',
    );
    expect(classifyByRule(at('https://shop.example.test/anything'))?.category).toBe('Shopping');
    expect(classifyByRule(at('https://some-brand.test/products/kettle'))?.category).toBe('Shopping');
    // Not every host beginning with those letters — a label boundary, as ever.
    expect(classifyByRule(at('https://storefront-blog.test/a'))).toBeNull();
  });

  it('declines rather than guessing on an unknown site', () => {
    expect(classifyByRule(at('https://some-random-blog.test/a/thing'))).toBeNull();
  });

  it('declines on anything that is not a real URL', () => {
    expect(classifyByRule(at('chrome://extensions'))).toBeNull();
    expect(classifyByRule(at('not a url'))).toBeNull();
    expect(classifyByRule(at(''))).toBeNull();
  });

  it('never claims certainty', () => {
    // A domain is strong evidence, never proof — github.com hosts blogs too.
    // Leaving headroom keeps the number meaningful once the LLM reports its own.
    const match = classifyByRule(at('https://github.com/a/b'));
    expect(match!.confidence).toBeLessThan(1);
    expect(match!.source).toBe('rule');
    expect(match!.rationale.length).toBeGreaterThan(0);
  });
});

/**
 * The guard that stops the LLM being paid to flip a coin.
 *
 * In production a bare `youtube.com` with no title came back as "Entertainment"
 * at 0.9 confidence, and bare reddit.com and twitter.com as "Social & Community"
 * on the same absence of evidence. The rule pass had already declined all three
 * for exactly the right reason; the model was simply never told it was allowed
 * to decline too.
 */
describe('hasUsableSignal', () => {
  it('rejects a bare host with no title', () => {
    expect(hasUsableSignal(at('https://www.youtube.com/', ''))).toBe(false);
    expect(hasUsableSignal(at('https://reddit.com/', 'Untitled'))).toBe(false);
    expect(hasUsableSignal(at('https://twitter.com/', 'New Tab'))).toBe(false);
  });

  it('rejects a title that only repeats the host', () => {
    expect(hasUsableSignal(at('https://muenchen.de/', 'muenchen.de'))).toBe(false);
  });

  it('accepts a real title even on a bare host', () => {
    expect(hasUsableSignal(at('https://youtube.com/', 'LangGraph Complete Course'))).toBe(true);
  });

  it('accepts a path worth reading even with no title', () => {
    expect(hasUsableSignal(at('https://youtube.com/playlist?list=kubernetes-deep-dive', ''))).toBe(
      true,
    );
    expect(hasUsableSignal(at('https://example.test/kubernetes/operators', ''))).toBe(true);
  });

  it('rejects anything that is not a URL at all', () => {
    expect(hasUsableSignal(at('not a url', 'whatever'))).toBe(false);
    expect(hasUsableSignal(at('', ''))).toBe(false);
  });
});

describe('runRulePass', () => {
  it('splits into answered and worth-paying-for', () => {
    const result = runRulePass([
      at('https://github.com/a/b'),
      at('https://arxiv.org/abs/1'),
      at('https://medium.com/@x/y'),
      at('https://unknown.test/z'),
    ]);

    expect(result.classified.map((c) => c.id)).toEqual([
      'https://github.com/a/b',
      'https://arxiv.org/abs/1',
    ]);
    expect(result.unresolved).toHaveLength(2);
  });

  it('accounts for every input exactly once', () => {
    // Nothing may be dropped: a bookmark that is neither classified nor queued
    // for the LLM would silently never be categorised at all.
    const input = [
      at('https://github.com/a'),
      at('https://medium.com/b'),
      at('chrome://extensions'),
      at('https://youtube.com/watch?v=1'),
    ];
    const result = runRulePass(input);
    expect(result.classified.length + result.unresolved.length).toBe(input.length);
  });

  it('handles an empty set', () => {
    expect(runRulePass([])).toEqual({ classified: [], unresolved: [] });
  });

  /**
   * Not an assertion about correctness — an assertion that the pass is worth
   * having. If a realistic corpus stops being meaningfully answered here, the
   * LLM bill has quietly grown and the cheapest fix is a domain entry, not a
   * prompt change.
   */
  it('answers a useful share of a realistic corpus', () => {
    const corpus = [
      'https://github.com/vercel/next.js',
      'https://stackoverflow.com/questions/1234/how-do-i',
      'https://developer.mozilla.org/en-US/docs/Web/API/fetch',
      'https://news.ycombinator.com/item?id=1',
      'https://arxiv.org/abs/2401.00001',
      'https://youtube.com/watch?v=abc',
      'https://reddit.com/r/programming',
      'https://medium.com/@author/post',
      'https://some-personal-blog.test/2024/thoughts',
      'https://linkedin.com/in/someone',
    ].map((url) => at(url));

    const { classified } = runRulePass(corpus);
    expect(classified.length / corpus.length).toBeGreaterThanOrEqual(0.6);
  });
});
