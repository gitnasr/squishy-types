import type { EpochMs, IsoDateTime, Uuid } from './common.js';

export type BookmarkStatus = 'active' | 'dead' | 'archived' | 'deleted';

/** How far up the enrichment tiers a bookmark has climbed. */
export type ContentState = 'pending' | 'client' | 'scraped' | 'failed';

/** Who created a folder. `sqishy` folders are safe to merge away; `user` ones are not. */
export type FolderOrigin = 'user' | 'sqishy';

/**
 * A node exactly as the browser hands it to us
 * (`chrome.bookmarks.BookmarkTreeNode` / `browser.bookmarks.BookmarkTreeNode`),
 * minus the fields we never read.
 */
export interface BrowserNode {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  dateAdded?: EpochMs;
  dateGroupModified?: EpochMs;
  index?: number;
  children?: BrowserNode[];
}

/** A browser node after `flattenTree`: depth resolved, parents normalised to `null` at the root. */
export interface FlatNode {
  id: string;
  parentId: string | null;
  title: string;
  /** `null` marks a folder. */
  url: string | null;
  dateAdded: EpochMs | null;
  depth: number;
  index: number;
}

export interface Folder {
  id: Uuid;
  userId: Uuid;
  chromeId: string;
  parentId: Uuid | null;
  title: string;
  /** Materialised path, e.g. `/Dev/Frontend/React`. */
  path: string;
  origin: FolderOrigin;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface Bookmark {
  id: Uuid;
  userId: Uuid;
  chromeId: string;
  folderId: Uuid | null;
  url: string;
  /** sha256 of `urlCanonical`. Cross-device identity key. */
  urlHash: string;
  urlCanonical: string;
  title: string;
  dateAdded: IsoDateTime;
  status: BookmarkStatus;
  contentState: ContentState;
  lastCheckedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface UrlParts {
  /** Original input, untouched. */
  original: string;
  /** Normalised form used for dedupe and hashing. */
  canonical: string;
  /** sha256 hex of `canonical`. */
  hash: string;
  host: string;
  /** Registrable-ish domain with `www.`/`m.` stripped. Used by the rule-based classifier. */
  domain: string;
  pathTokens: string[];
}
