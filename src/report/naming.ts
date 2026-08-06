/**
 * Tokens that carry no meaning in a folder name. Dropping them is what makes
 * `JS`, `Javascript` and `JS Stuff` collapse to the same normalised key.
 */
const FILLER_TOKENS = new Set([
  'stuff', 'misc', 'miscellaneous', 'things', 'random', 'other', 'others', 'new', 'folder',
  'my', 'saved', 'bookmarks', 'bookmark', 'links', 'link', 'general', 'various', 'assorted',
  // Conjunctions and articles. `&` expands to `and`, so this must include it or
  // "Design & UI" and "UI / Design" stop matching.
  'and', 'or', 'the', 'a', 'an', 'of', 'for', 'to', 'in', 'on', 'with',
]);

const ALIASES: Record<string, string> = {
  javascript: 'js',
  ecmascript: 'js',
  typescript: 'ts',
  python: 'py',
  golang: 'go',
  kubernetes: 'k8s',
  postgresql: 'postgres',
  psql: 'postgres',
  documentation: 'docs',
  doc: 'docs',
  reference: 'docs',
  tutorials: 'tutorial',
  articles: 'article',
  tools: 'tool',
  utilities: 'tool',
  utils: 'tool',
  jobs: 'job',
  career: 'job',
  careers: 'job',
  design: 'design',
  ui: 'design',
  ux: 'design',
};

const VAGUE_TITLES = new Set([
  'untitled', 'new tab', 'read later', 'read it later', 'later', 'todo', 'to do', 'to-do',
  'stuff', 'misc', 'temp', 'tmp', 'test', 'link', 'page', 'document', 'bookmark', 'home',
  'index', '(no title)', 'no title', 'unknown', 'loading', 'error', '...',
]);

/**
 * Collapses a folder name to a comparison key: lowercase, punctuation removed,
 * filler dropped, aliases applied, tokens sorted so word order stops mattering.
 */
export function normalizeFolderName(title: string): string {
  const tokens = title
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0 && !FILLER_TOKENS.has(token))
    .map((token) => ALIASES[token] ?? token);

  const unique = [...new Set(tokens)].sort();
  return unique.join(' ');
}

export function isUntitled(title: string): boolean {
  return title.trim() === '';
}

export function isVagueTitle(title: string, url: string): boolean {
  const trimmed = title.trim();
  if (trimmed === '') return false; // counted separately as untitled
  const lower = trimmed.toLowerCase();
  if (VAGUE_TITLES.has(lower)) return true;
  if (trimmed.length <= 2) return true;
  if (lower === url.toLowerCase()) return true;
  return /^https?:\/\//i.test(trimmed);
}

export function titleEqualsUrl(title: string, url: string): boolean {
  const t = title.trim().toLowerCase().replace(/\/$/, '');
  const u = url.trim().toLowerCase().replace(/\/$/, '');
  if (t === '') return false;
  return t === u || t === u.replace(/^https?:\/\//, '');
}

/** Bounded Levenshtein — returns `max + 1` as soon as it is certain the distance exceeds `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        (curr[j - 1] as number) + 1,
        (prev[j] as number) + 1,
        (prev[j - 1] as number) + cost,
      );
      curr[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    const swap = prev;
    prev = curr;
    curr = swap;
  }

  return prev[b.length] as number;
}
