import { parseUrl } from '../url/canonical.js';
import type { ClassifiableBookmark, TitleCluster, ClusterOptions } from '../types/index.js';

/**
 * Grouping the leftovers by what they talk about.
 *
 * Sits between the deterministic rules and the LLM. The rules answer known
 * domains; this catches the pattern they cannot see — twelve bookmarks that all
 * mention "kubernetes" across a dozen different hosts obviously belong
 * together, and noticing that needs no model.
 *
 * TF-IDF over title and path tokens rather than embeddings, deliberately.
 * Embeddings cost an API call per bookmark and produce a cosine score, and a
 * user asked to approve a folder cannot judge "0.87". They can judge "12
 * bookmarks mention kubernetes". Every grouping here becomes a proposal a human
 * approves, so an explanation they can check is worth more than a slightly
 * better clustering they cannot.
 *
 * Embeddings still earn their place later, for semantic search and
 * near-duplicate detection, where the question genuinely is not lexical.
 */

/**
 * Words that describe how a page is written rather than what it is about.
 *
 * Without these, the largest cluster in almost any collection is "how", and a
 * folder called "How" is worse than no folder at all.
 */
const STOP_WORDS = new Set([
  'how', 'what', 'why', 'when', 'where', 'who', 'which', 'guide', 'tutorial', 'introduction',
  'intro', 'getting', 'started', 'start', 'learn', 'learning', 'best', 'top', 'ultimate',
  'complete', 'beginners', 'beginner', 'advanced', 'part', 'using', 'use', 'build', 'building',
  'create', 'creating', 'make', 'making', 'understand', 'understanding', 'example', 'examples',
  'tips', 'tricks', 'guide', 'overview', 'about', 'home', 'page', 'index', 'welcome', 'blog',
  'post', 'article', 'news', 'docs', 'doc', 'documentation', 'reference', 'api', 'github', 'com',
  'www', 'org', 'net', 'io', 'the', 'and', 'or', 'a', 'an', 'of', 'for', 'to', 'in', 'on', 'with',
  'your', 'you', 'my', 'is', 'are', 'it', 'this', 'that', 'from', 'by', 'at', 'as', 'be',
]);

const DEFAULTS: Required<ClusterOptions> = {
  // Spec §6.2: a new category needs at least five members. A folder of two is
  // the sprawl the cleanup report complains about, so creating one here would
  // be the product arguing with itself.
  minClusterSize: 5,
  // A token has to describe a real share of the group, or the group is a
  // coincidence rather than a topic.
  minCoverage: 0.6,
  maxClusters: 12,
};

/** Significant tokens for one bookmark: title words plus URL path words. */
function tokensOf(bookmark: ClassifiableBookmark): Set<string> {
  const parts = parseUrl(bookmark.url);
  const fromTitle = bookmark.title
    .toLowerCase()
    .split(/[^a-z0-9+#]+/i)
    .filter(Boolean);

  const tokens = new Set<string>();
  for (const token of [...fromTitle, ...parts.pathTokens]) {
    // Two characters is not a topic, and pure numbers are versions and dates.
    if (token.length < 3 || /^\d+$/.test(token)) continue;
    if (STOP_WORDS.has(token)) continue;
    tokens.add(token);
  }

  // The host's own name is not a topic either — every bookmark on a site shares
  // it, so it would cluster the site rather than the subject.
  const host = parts.domain.split('.')[0];
  if (host) tokens.delete(host);

  return tokens;
}

/** Title case, so a folder reads like a folder rather than a search term. */
function asFolderName(token: string): string {
  return token.charAt(0).toUpperCase() + token.slice(1);
}

/**
 * Groups bookmarks by their most distinctive shared token.
 *
 * Scored by TF-IDF so that a token appearing in nearly everything — the user's
 * own dominant subject — does not swallow the whole collection into one folder.
 * Rare-but-shared is what a useful group looks like.
 *
 * Each bookmark lands in at most one cluster. A bookmark in three folders is
 * not a filing system, and the browser cannot represent it anyway.
 */
export function clusterByTitle(
  bookmarks: ClassifiableBookmark[],
  options: ClusterOptions = {},
): TitleCluster[] {
  const settings = { ...DEFAULTS, ...options };
  if (bookmarks.length < settings.minClusterSize) return [];

  const tokensById = new Map<string, Set<string>>();
  const documentFrequency = new Map<string, number>();

  for (const bookmark of bookmarks) {
    const tokens = tokensOf(bookmark);
    tokensById.set(bookmark.id, tokens);
    for (const token of tokens) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }

  const total = bookmarks.length;
  const candidates: { token: string; ids: string[]; score: number }[] = [];

  for (const [token, frequency] of documentFrequency) {
    if (frequency < settings.minClusterSize) continue;
    // A token in almost every bookmark describes the collection, not a subset.
    if (frequency / total > 0.5) continue;

    const ids = bookmarks.filter((b) => tokensById.get(b.id)?.has(token)).map((b) => b.id);
    // Classic IDF: rarer tokens are more distinctive, and distinctiveness is
    // exactly what makes a folder name meaningful.
    const idf = Math.log(total / frequency);
    candidates.push({ token, ids, score: ids.length * idf });
  }

  candidates.sort((a, b) => b.score - a.score);

  const claimed = new Set<string>();
  const clusters: TitleCluster[] = [];

  for (const candidate of candidates) {
    if (clusters.length >= settings.maxClusters) break;

    const available = candidate.ids.filter((id) => !claimed.has(id));
    if (available.length < settings.minClusterSize) continue;

    // Coverage guards against a cluster held together by a token most of its
    // members no longer contribute, once the stronger clusters took their pick.
    if (available.length / candidate.ids.length < settings.minCoverage) continue;

    for (const id of available) claimed.add(id);

    clusters.push({
      name: asFolderName(candidate.token),
      token: candidate.token,
      bookmarkIds: available,
      // Deliberately capped below the rule pass's floor: a shared word is
      // weaker evidence than a known domain, and the review queue sorts by
      // confidence so these should be read first.
      confidence: Math.min(0.75, 0.4 + available.length / (total * 2)),
      rationale: `${available.length} bookmarks mention "${candidate.token}"`,
    });
  }

  return clusters;
}
