import { parseUrl } from '../url/canonical.js';
import type {
  Category,
  ClassifiableBookmark,
  Classification,
  RulePassResult,
} from '../types/index.js';

/**
 * The deterministic rule pass.
 *
 * Runs before any LLM call and short-circuits the obvious cases at zero cost.
 * `github.com/user/repo` and `stackoverflow.com/questions/…` do not need a
 * language model to classify, and spending one on them is money burned on a
 * problem a lookup table solves.
 *
 * This is also a quota decision, not just a cost one: rule-based results
 * **do not draw down a user's 20 free URLs** (spec §5). So the honest bar for
 * putting a domain in this table is "I would be comfortable showing this
 * classification to the user with no further thought" — a rule that is merely
 * probable belongs in `unresolved`, where the LLM can look at the title too.
 *
 * Pure: no I/O, no `chrome.*`, no network. It runs identically in the
 * extension, the API and the worker.
 */

/**
 * Confidence assigned to a domain match.
 *
 * Not 1.0 — a domain is strong evidence, never proof. `github.com` hosts blogs
 * and `medium.com` hosts engineering posts. Leaving headroom keeps the number
 * meaningful when the LLM later reports its own.
 */
export const RULE_CONFIDENCE_DOMAIN = 0.9;

/** A path or title match on top of a weaker domain signal. */
export const RULE_CONFIDENCE_PATH = 0.8;

/** Below this the rule pass declines to answer and defers to the LLM. */
export const RULE_CONFIDENCE_FLOOR = 0.8;

/**
 * Domains whose whole purpose is one category.
 *
 * Matched against the **canonical** host, so `www.` and `m.` are already gone
 * and a subdomain like `docs.` is still visible where it matters. Suffix
 * matching, so `gist.github.com` follows `github.com`.
 */
const DOMAIN_RULES: [string, Category][] = [
  // Development
  ['github.com', 'Development'],
  ['gitlab.com', 'Development'],
  ['bitbucket.org', 'Development'],
  ['stackoverflow.com', 'Development'],
  ['stackexchange.com', 'Development'],
  ['npmjs.com', 'Development'],
  ['pypi.org', 'Development'],
  ['crates.io', 'Development'],
  ['packagist.org', 'Development'],
  ['rubygems.org', 'Development'],
  ['codepen.io', 'Development'],
  ['codesandbox.io', 'Development'],
  ['leetcode.com', 'Development'],
  ['codewars.com', 'Development'],

  // DevOps & Infra
  ['docker.com', 'DevOps & Infra'],
  ['hub.docker.com', 'DevOps & Infra'],
  ['kubernetes.io', 'DevOps & Infra'],
  ['terraform.io', 'DevOps & Infra'],
  ['aws.amazon.com', 'DevOps & Infra'],
  ['console.aws.amazon.com', 'DevOps & Infra'],
  ['cloud.google.com', 'DevOps & Infra'],
  ['azure.microsoft.com', 'DevOps & Infra'],
  ['digitalocean.com', 'DevOps & Infra'],
  ['cloudflare.com', 'DevOps & Infra'],
  ['grafana.com', 'DevOps & Infra'],
  ['prometheus.io', 'DevOps & Infra'],

  // AI & ML
  ['huggingface.co', 'AI & ML'],
  ['openai.com', 'AI & ML'],
  ['anthropic.com', 'AI & ML'],
  ['claude.ai', 'AI & ML'],
  ['kaggle.com', 'AI & ML'],
  ['pytorch.org', 'AI & ML'],
  ['tensorflow.org', 'AI & ML'],
  ['paperswithcode.com', 'AI & ML'],

  // Design & UI
  ['figma.com', 'Design & UI'],
  ['dribbble.com', 'Design & UI'],
  ['behance.net', 'Design & UI'],
  ['unsplash.com', 'Design & UI'],
  ['fonts.google.com', 'Design & UI'],
  ['coolors.co', 'Design & UI'],

  // Documentation & Reference
  ['developer.mozilla.org', 'Documentation & Reference'],
  ['docs.python.org', 'Documentation & Reference'],
  ['docs.rs', 'Documentation & Reference'],
  ['readthedocs.io', 'Documentation & Reference'],
  ['w3.org', 'Documentation & Reference'],
  ['caniuse.com', 'Documentation & Reference'],

  // Research & Papers
  ['arxiv.org', 'Research & Papers'],
  ['scholar.google.com', 'Research & Papers'],
  ['pubmed.ncbi.nlm.nih.gov', 'Research & Papers'],
  ['jstor.org', 'Research & Papers'],
  ['sciencedirect.com', 'Research & Papers'],
  ['nature.com', 'Research & Papers'],

  // Learning & Courses
  ['coursera.org', 'Learning & Courses'],
  ['udemy.com', 'Learning & Courses'],
  ['edx.org', 'Learning & Courses'],
  ['khanacademy.org', 'Learning & Courses'],
  ['freecodecamp.org', 'Learning & Courses'],
  ['pluralsight.com', 'Learning & Courses'],

  // Career & Jobs
  ['linkedin.com', 'Career & Jobs'],
  ['indeed.com', 'Career & Jobs'],
  ['glassdoor.com', 'Career & Jobs'],
  ['wellfound.com', 'Career & Jobs'],

  // News & Articles
  ['news.ycombinator.com', 'News & Articles'],
  ['bbc.com', 'News & Articles'],
  ['theguardian.com', 'News & Articles'],
  ['reuters.com', 'News & Articles'],
  ['techcrunch.com', 'News & Articles'],
  ['arstechnica.com', 'News & Articles'],

  // Social & Community
  ['facebook.com', 'Social & Community'],
  ['instagram.com', 'Social & Community'],
  ['discord.com', 'Social & Community'],
  ['mastodon.social', 'Social & Community'],

  // Entertainment
  ['netflix.com', 'Entertainment'],
  ['twitch.tv', 'Entertainment'],
  ['spotify.com', 'Entertainment'],
  ['imdb.com', 'Entertainment'],

  // Shopping
  ['amazon.com', 'Shopping'],
  ['ebay.com', 'Shopping'],
  ['etsy.com', 'Shopping'],
  ['aliexpress.com', 'Shopping'],

  // Finance
  ['coinbase.com', 'Finance'],
  ['binance.com', 'Finance'],
  ['tradingview.com', 'Finance'],
  ['bloomberg.com', 'Finance'],

  // Travel
  ['booking.com', 'Travel'],
  ['airbnb.com', 'Travel'],
  ['tripadvisor.com', 'Travel'],
  ['skyscanner.net', 'Travel'],

  // Health
  ['who.int', 'Health'],
  ['mayoclinic.org', 'Health'],
  ['healthline.com', 'Health'],

  // Product & Business
  ['producthunt.com', 'Product & Business'],
  ['notion.so', 'Product & Business'],
  ['atlassian.net', 'Product & Business'],
  ['trello.com', 'Product & Business'],
];

/**
 * Domains that host too many kinds of thing to classify by host alone.
 *
 * These are the trap: `medium.com` is roughly half engineering and half
 * everything else, and a domain rule for it would misfile a large minority
 * silently and confidently. They go to the LLM, which can read the title.
 */
const AMBIGUOUS_DOMAINS = new Set([
  // Platforms, not subjects. A LangGraph course and a music video are both
  // youtube.com; r/StableDiffusion and r/cooking are both reddit.com. Filing
  // by host puts a machine-learning tutorial in "Entertainment", which is not
  // a small inaccuracy — it is the product actively making someone's
  // bookmarks worse, confidently, in bulk.
  'youtube.com',
  'youtu.be',
  'reddit.com',
  'x.com',
  'twitter.com',
  'medium.com',
  'substack.com',
  'dev.to',
  'hashnode.dev',
  'blogspot.com',
  'wordpress.com',
  'tumblr.com',
  'google.com',
  'docs.google.com',
  'drive.google.com',
  'dropbox.com',
  'pinterest.com',
  'quora.com',
  'wikipedia.org',
]);

/**
 * Path-shape rules on hosts that would otherwise be ambiguous.
 *
 * Only for shapes that are genuinely unambiguous — a YouTube *playlist* is
 * still entertainment, but `github.com/…/docs` is not necessarily docs.
 */
const PATH_RULES: [RegExp, Category, string][] = [
  [/^\/questions\//, 'Development', 'a question thread'],
  [/^\/(docs|documentation|reference|api)(\/|$)/, 'Documentation & Reference', 'a docs path'],
  [/^\/(blog|posts?|articles?)(\/|$)/, 'News & Articles', 'an article path'],
  [/^\/(jobs?|careers?)(\/|$)/, 'Career & Jobs', 'a careers path'],
  [/^\/(pricing|checkout|cart)(\/|$)/, 'Shopping', 'a commerce path'],
];

function matchDomain(host: string): Category | null {
  for (const [domain, category] of DOMAIN_RULES) {
    // Suffix match on a label boundary, so `gist.github.com` inherits
    // `github.com` while `nongithub.com` does not.
    if (host === domain || host.endsWith(`.${domain}`)) return category;
  }
  return null;
}

function isAmbiguous(host: string): boolean {
  for (const domain of AMBIGUOUS_DOMAINS) {
    if (host === domain || host.endsWith(`.${domain}`)) return true;
  }
  return false;
}

/**
 * Classifies one bookmark, or declines.
 *
 * Returns `null` rather than guessing. A wrong category that costs nothing is
 * still wrong, and the user sees it in the review queue either way — the rule
 * pass saves money, not trust.
 */
export function classifyByRule(bookmark: ClassifiableBookmark): Classification | null {
  const parts = parseUrl(bookmark.url);
  if (parts.host === '') return null;

  const host = parts.domain;

  // Ambiguity is checked first: a host on this list must not be rescued by a
  // path rule, because the path is what makes those hosts ambiguous.
  if (isAmbiguous(host)) return null;

  const byDomain = matchDomain(host);
  if (byDomain) {
    return {
      category: byDomain,
      confidence: RULE_CONFIDENCE_DOMAIN,
      source: 'rule',
      rationale: `${host} is a ${byDomain.toLowerCase()} site`,
    };
  }

  let pathname = '';
  try {
    pathname = new URL(parts.canonical).pathname;
  } catch {
    return null;
  }

  for (const [pattern, category, why] of PATH_RULES) {
    if (pattern.test(pathname)) {
      return {
        category,
        confidence: RULE_CONFIDENCE_PATH,
        source: 'rule',
        rationale: `${host} on ${why}`,
      };
    }
  }

  return null;
}

/**
 * Splits a set of bookmarks into "already answered" and "worth paying for".
 *
 * The ratio is the number that decides what categorisation costs. It is worth
 * watching: a corpus where the rules answer 40% is a corpus where the LLM bill
 * is 40% smaller, and the cheapest way to reduce spend is to add a domain here
 * rather than to tune a prompt.
 */
export function runRulePass(bookmarks: ClassifiableBookmark[]): RulePassResult {
  const classified: RulePassResult['classified'] = [];
  const unresolved: ClassifiableBookmark[] = [];

  for (const bookmark of bookmarks) {
    const classification = classifyByRule(bookmark);
    if (classification && classification.confidence >= RULE_CONFIDENCE_FLOOR) {
      classified.push({ id: bookmark.id, classification });
    } else {
      unresolved.push(bookmark);
    }
  }

  return { classified, unresolved };
}
