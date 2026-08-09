import type {
  CleanupReport,
  DuplicateGroup,
  FlatNode,
  FolderSummary,
  ReportInput,
  SimilarFolderGroup,
  TitleSample,
} from '../types/index.js';
import { PROTOCOL_VERSION } from '../protocol.js';
import { canonicalizeUrl, urlHash } from '../url/canonical.js';
import { editDistance, isUntitled, isVagueTitle, normalizeFolderName, titleEqualsUrl } from './naming.js';

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const DEEP_NESTING_THRESHOLD = 4;
const DUMPING_GROUND_MIN_ITEMS = 20;
const DUMPING_GROUND_MIN_SHARE = 0.25;
const MAX_SAMPLES = 10;
const MAX_GROUPS = 200;

function buildPath(node: FlatNode, byId: Map<string, FlatNode>): string {
  const parts: string[] = [];
  let current: FlatNode | undefined = node;
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    parts.unshift(current.title || '(untitled)');
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return `/${parts.join('/')}`;
}

function pickSurvivor(nodes: FlatNode[]): string {
  let best = nodes[0] as FlatNode;
  for (const node of nodes) {
    const bestDate = best.dateAdded ?? Number.MAX_SAFE_INTEGER;
    const nodeDate = node.dateAdded ?? Number.MAX_SAFE_INTEGER;
    if (nodeDate < bestDate) {
      best = node;
    } else if (nodeDate === bestDate && node.title.length > best.title.length) {
      best = node;
    }
  }
  return best.id;
}

function groupDuplicates(
  bookmarks: FlatNode[],
  keyOf: (node: FlatNode) => string,
  kind: 'exact' | 'canonical',
): DuplicateGroup[] {
  const buckets = new Map<string, FlatNode[]>();
  for (const node of bookmarks) {
    const key = keyOf(node);
    if (key === '') continue;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(node);
    else buckets.set(key, [node]);
  }

  const groups: DuplicateGroup[] = [];
  for (const [key, nodes] of buckets) {
    if (nodes.length < 2) continue;
    groups.push({
      key,
      kind,
      url: (nodes[0] as FlatNode).url ?? '',
      nodeIds: nodes.map((n) => n.id),
      keepNodeId: pickSurvivor(nodes),
      count: nodes.length,
    });
  }

  groups.sort((a, b) => b.count - a.count);
  return groups.slice(0, MAX_GROUPS);
}

function groupSimilarFolders(folders: FolderSummary[]): SimilarFolderGroup[] {
  const byNormalized = new Map<string, FolderSummary[]>();
  for (const folder of folders) {
    const key = normalizeFolderName(folder.title);
    if (key === '') continue;
    const bucket = byNormalized.get(key);
    if (bucket) bucket.push(folder);
    else byNormalized.set(key, [folder]);
  }

  // Merge keys that are one edit apart ("frontend" / "front end" survive
  // normalisation as distinct keys but mean the same folder).
  const keys = [...byNormalized.keys()];
  const mergedInto = new Map<string, string>();
  for (let i = 0; i < keys.length; i++) {
    const a = keys[i] as string;
    if (mergedInto.has(a)) continue;
    for (let j = i + 1; j < keys.length; j++) {
      const b = keys[j] as string;
      if (mergedInto.has(b)) continue;
      if (a.length < 4 || b.length < 4) continue;
      if (editDistance(a, b, 1) <= 1) mergedInto.set(b, a);
    }
  }

  const merged = new Map<string, FolderSummary[]>();
  for (const [key, list] of byNormalized) {
    const target = mergedInto.get(key) ?? key;
    const bucket = merged.get(target);
    if (bucket) bucket.push(...list);
    else merged.set(target, [...list]);
  }

  const groups: SimilarFolderGroup[] = [];
  for (const [normalized, list] of merged) {
    if (list.length < 2) continue;
    groups.push({ normalized, folders: list });
  }
  groups.sort((a, b) => b.folders.length - a.folders.length);
  return groups.slice(0, MAX_GROUPS);
}

/**
 * The first-run cleanup report. Pure: no I/O, no `chrome.*`, no network.
 * Runs in the extension before sign-in, and server-side later for the web app.
 */
export function buildCleanupReport(input: ReportInput): CleanupReport {
  const now = input.now ?? Date.now();
  const nodes = input.nodes;

  const byId = new Map<string, FlatNode>();
  for (const node of nodes) byId.set(node.id, node);

  const bookmarks: FlatNode[] = [];
  const folderNodes: FlatNode[] = [];
  for (const node of nodes) {
    if (node.url === null) folderNodes.push(node);
    else bookmarks.push(node);
  }

  // ---- folder statistics ------------------------------------------------
  const directBookmarks = new Map<string, number>();
  const directFolders = new Map<string, number>();
  for (const node of nodes) {
    if (node.parentId === null) continue;
    const target = node.url === null ? directFolders : directBookmarks;
    target.set(node.parentId, (target.get(node.parentId) ?? 0) + 1);
  }

  const folderSummaries: FolderSummary[] = folderNodes.map((folder) => ({
    id: folder.id,
    title: folder.title,
    path: buildPath(folder, byId),
    depth: folder.depth,
    bookmarkCount: directBookmarks.get(folder.id) ?? 0,
    childFolderCount: directFolders.get(folder.id) ?? 0,
  }));

  const empty = folderSummaries.filter((f) => f.bookmarkCount === 0 && f.childFolderCount === 0);
  const singleItem = folderSummaries.filter((f) => f.bookmarkCount + f.childFolderCount === 1);
  const deeplyNested = folderSummaries.filter((f) => f.depth > DEEP_NESTING_THRESHOLD);
  const similarNames = groupSimilarFolders(folderSummaries);

  let dumpingGround: FolderSummary | null = null;
  for (const folder of folderSummaries) {
    if (folder.depth > 1) continue;
    if (folder.bookmarkCount < DUMPING_GROUND_MIN_ITEMS) continue;
    if (folder.bookmarkCount < bookmarks.length * DUMPING_GROUND_MIN_SHARE) continue;
    if (!dumpingGround || folder.bookmarkCount > dumpingGround.bookmarkCount) {
      dumpingGround = folder;
    }
  }

  // ---- duplicates -------------------------------------------------------
  const exactGroups = groupDuplicates(bookmarks, (n) => (n.url ?? '').trim(), 'exact');
  const canonicalGroups = groupDuplicates(bookmarks, (n) => (n.url ? urlHash(n.url) : ''), 'canonical');
  const wastedEntries = canonicalGroups.reduce((sum, group) => sum + group.count - 1, 0);

  // ---- naming -----------------------------------------------------------
  let untitled = 0;
  let vague = 0;
  let sameAsUrl = 0;
  const samples: TitleSample[] = [];
  for (const node of bookmarks) {
    const url = node.url ?? '';
    if (isUntitled(node.title)) {
      untitled += 1;
    } else if (isVagueTitle(node.title, url)) {
      vague += 1;
    }
    if (titleEqualsUrl(node.title, url)) sameAsUrl += 1;
    if (samples.length < MAX_SAMPLES && (isUntitled(node.title) || isVagueTitle(node.title, url))) {
      samples.push({ id: node.id, title: node.title, url });
    }
  }

  // ---- age --------------------------------------------------------------
  let oldest: number | null = null;
  let newest: number | null = null;
  let olderThan1Year = 0;
  let olderThan3Years = 0;
  let olderThan5Years = 0;
  let undated = 0;
  for (const node of bookmarks) {
    const added = node.dateAdded;
    if (added === null) {
      undated += 1;
      continue;
    }
    if (oldest === null || added < oldest) oldest = added;
    if (newest === null || added > newest) newest = added;
    const age = now - added;
    if (age > YEAR_MS) olderThan1Year += 1;
    if (age > YEAR_MS * 3) olderThan3Years += 1;
    if (age > YEAR_MS * 5) olderThan5Years += 1;
  }

  // ---- engagement -------------------------------------------------------
  const historyAvailable = Array.isArray(input.history);
  let neverRevisited = 0;
  let notVisitedIn1Year = 0;
  if (historyAvailable) {
    const visits = new Map<string, { visitCount: number; lastVisitAt: number | null }>();
    for (const stat of input.history ?? []) {
      const key = canonicalizeUrl(stat.url);
      const existing = visits.get(key);
      if (existing) {
        existing.visitCount += stat.visitCount;
        if ((stat.lastVisitAt ?? 0) > (existing.lastVisitAt ?? 0)) existing.lastVisitAt = stat.lastVisitAt;
      } else {
        visits.set(key, { visitCount: stat.visitCount, lastVisitAt: stat.lastVisitAt });
      }
    }
    for (const node of bookmarks) {
      const stat = visits.get(canonicalizeUrl(node.url ?? ''));
      // Absent from history counts as never revisited: Chrome expires history,
      // and a bookmark with no recorded visit is exactly the signal we want.
      if (!stat || stat.visitCount <= 1) neverRevisited += 1;
      if (!stat || stat.lastVisitAt === null || now - stat.lastVisitAt > YEAR_MS) notVisitedIn1Year += 1;
    }
  }

  const similarNameSurplus = similarNames.reduce((sum, group) => sum + group.folders.length - 1, 0);
  const issueCount =
    wastedEntries +
    empty.length +
    singleItem.length +
    deeplyNested.length +
    similarNameSurplus +
    untitled +
    vague;

  const topLevelBookmarks = bookmarks.filter((node) => node.depth <= 1).length;

  /**
   * What the product can actually do something about.
   *
   * `issueCount` is a diagnosis and counts everything worth knowing — including
   * vague names, deep nesting and near-identical folder names, none of which any
   * pass can currently fix. Wiring the "Fix N issues" button to it promised
   * eight fixes and delivered none, because seven of the eight were badly-named
   * bookmarks and nothing in the pipeline renames anything.
   *
   * A button must never name a number larger than the work behind it. This is
   * that number: duplicates to remove, folders to tidy, and loose bookmarks to
   * file. Categorisation may still decline on some of the loose ones, so the
   * outcome is reported honestly afterwards — but the promise is at least the
   * right shape.
   */
  const fixable = wastedEntries + empty.length + singleItem.length + topLevelBookmarks;

  return {
    generatedAt: now,
    protocolVersion: PROTOCOL_VERSION,
    totals: {
      bookmarks: bookmarks.length,
      folders: folderNodes.length,
      maxDepth: nodes.reduce((max, node) => Math.max(max, node.depth), 0),
      topLevelBookmarks,
      averageFolderSize: folderNodes.length === 0 ? 0 : bookmarks.length / folderNodes.length,
    },
    duplicates: {
      exactGroups,
      canonicalGroups,
      exactCount: exactGroups.length,
      canonicalCount: canonicalGroups.length,
      wastedEntries,
    },
    folders: {
      total: folderNodes.length,
      empty,
      singleItem,
      deeplyNested,
      similarNames,
      dumpingGround,
    },
    naming: { untitled, vague, titleEqualsUrl: sameAsUrl, samples },
    age: {
      oldestAddedAt: oldest,
      newestAddedAt: newest,
      olderThan1Year,
      olderThan3Years,
      olderThan5Years,
      undated,
    },
    engagement: { historyAvailable, neverRevisited, notVisitedIn1Year },
    issueCount,
    fixable,
  };
}
