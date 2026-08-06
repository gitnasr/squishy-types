import type { EpochMs } from './common.js';
import type { FlatNode } from './bookmark.js';

/** One `chrome.history` datum. Optional — the permission is requested in-context, not at install. */
export interface HistoryStat {
  url: string;
  visitCount: number;
  lastVisitAt: EpochMs | null;
}

export interface ReportInput {
  nodes: FlatNode[];
  history?: HistoryStat[];
  /** Injectable clock so report snapshots are deterministic in tests. */
  now?: EpochMs;
}

export interface DuplicateGroup {
  /** `urlHash` for canonical groups, the raw URL for exact groups. */
  key: string;
  kind: 'exact' | 'canonical';
  url: string;
  nodeIds: string[];
  /** Earliest `dateAdded` wins; ties break on the longest title. */
  keepNodeId: string;
  count: number;
}

export interface FolderSummary {
  id: string;
  title: string;
  path: string;
  depth: number;
  bookmarkCount: number;
  childFolderCount: number;
}

export interface SimilarFolderGroup {
  /** Shared normalised name, e.g. `js` for `JS` / `Javascript` / `JS Stuff`. */
  normalized: string;
  folders: FolderSummary[];
}

export interface TitleSample {
  id: string;
  title: string;
  url: string;
}

export interface ReportTotals {
  bookmarks: number;
  folders: number;
  maxDepth: number;
  /** Bookmarks sitting loose at the root — the classic dumping ground. */
  topLevelBookmarks: number;
  averageFolderSize: number;
}

export interface ReportDuplicates {
  exactGroups: DuplicateGroup[];
  canonicalGroups: DuplicateGroup[];
  exactCount: number;
  canonicalCount: number;
  /** How many entries would disappear if every group collapsed to one. */
  wastedEntries: number;
}

export interface ReportFolders {
  total: number;
  empty: FolderSummary[];
  singleItem: FolderSummary[];
  deeplyNested: FolderSummary[];
  similarNames: SimilarFolderGroup[];
  dumpingGround: FolderSummary | null;
}

export interface ReportNaming {
  untitled: number;
  vague: number;
  titleEqualsUrl: number;
  samples: TitleSample[];
}

export interface ReportAge {
  oldestAddedAt: EpochMs | null;
  newestAddedAt: EpochMs | null;
  olderThan1Year: number;
  olderThan3Years: number;
  olderThan5Years: number;
  undated: number;
}

export interface ReportEngagement {
  /** False when the `history` permission was declined — the section degrades, the report still ships. */
  historyAvailable: boolean;
  neverRevisited: number;
  notVisitedIn1Year: number;
}

/**
 * The first-run hook. Built entirely from free signals, computed in the
 * extension, and never sent to the server before sign-in.
 */
export interface CleanupReport {
  generatedAt: EpochMs;
  protocolVersion: number;
  totals: ReportTotals;
  duplicates: ReportDuplicates;
  folders: ReportFolders;
  naming: ReportNaming;
  age: ReportAge;
  engagement: ReportEngagement;
  /** The number behind the "Fix N issues" CTA. */
  issueCount: number;
}
