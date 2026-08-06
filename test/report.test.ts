import { describe, expect, it } from 'vitest';
import type { BrowserNode } from '../src/types/index.js';
import { buildCleanupReport } from '../src/report/engine.js';
import { flattenTree } from '../src/report/flatten.js';

const NOW = Date.UTC(2026, 7, 6);
const YEAR = 365 * 24 * 60 * 60 * 1000;

/**
 * Mirrors what `chrome.bookmarks.getTree()` actually returns: a synthetic
 * root wrapping "Bookmarks bar" and "Other bookmarks".
 */
const tree: BrowserNode[] = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        title: 'Bookmarks bar',
        children: [
          { id: '10', title: 'Example', url: 'https://example.com/?utm_source=x', dateAdded: NOW - YEAR * 6 },
          { id: '11', title: 'Example (mirror)', url: 'https://www.example.com', dateAdded: NOW - YEAR * 2 },
          { id: '14', title: 'Example', url: 'https://example.com/?utm_source=x', dateAdded: NOW - YEAR * 4 },
          { id: '15', title: '', url: 'https://untitled.dev', dateAdded: NOW - 1000 },
          { id: '16', title: 'read later', url: 'https://vague.dev', dateAdded: NOW - 1000 },
          {
            id: '12',
            title: 'JS',
            children: [{ id: '120', title: 'A', url: 'https://a.com', dateAdded: NOW - 1000 }],
          },
          { id: '13', title: 'Javascript', children: [] },
        ],
      },
      { id: '2', title: 'Other bookmarks', children: [] },
    ],
  },
];

const nodes = flattenTree(tree);
const report = buildCleanupReport({ nodes, now: NOW });

describe('flattenTree', () => {
  it('unwraps the synthetic root so real roots sit at depth 0', () => {
    const bar = nodes.find((n) => n.id === '1');
    expect(bar?.depth).toBe(0);
    expect(bar?.parentId).toBeNull();
    expect(nodes.find((n) => n.id === '0')).toBeUndefined();
  });

  it('marks folders with a null url', () => {
    expect(nodes.find((n) => n.id === '12')?.url).toBeNull();
    expect(nodes.find((n) => n.id === '120')?.url).toBe('https://a.com');
  });
});

describe('buildCleanupReport', () => {
  it('counts bookmarks, folders and depth', () => {
    expect(report.totals.bookmarks).toBe(6);
    expect(report.totals.folders).toBe(4);
    expect(report.totals.maxDepth).toBe(2);
    expect(report.totals.topLevelBookmarks).toBe(5);
  });

  it('finds exact duplicates', () => {
    const group = report.duplicates.exactGroups.find((g) => g.count === 2);
    expect(group?.nodeIds.sort()).toEqual(['10', '14']);
  });

  it('finds canonical duplicates across www and tracking params', () => {
    const group = report.duplicates.canonicalGroups[0];
    expect(group?.count).toBe(3);
    expect(group?.nodeIds.sort()).toEqual(['10', '11', '14']);
    expect(report.duplicates.wastedEntries).toBe(2);
  });

  it('keeps the earliest copy', () => {
    expect(report.duplicates.canonicalGroups[0]?.keepNodeId).toBe('10');
  });

  it('flags empty and single-item folders', () => {
    expect(report.folders.empty.map((f) => f.id).sort()).toEqual(['13', '2']);
    expect(report.folders.singleItem.map((f) => f.id)).toEqual(['12']);
  });

  it('groups near-identical folder names', () => {
    const group = report.folders.similarNames.find((g) => g.normalized === 'js');
    expect(group?.folders.map((f) => f.id).sort()).toEqual(['12', '13']);
  });

  it('builds materialised paths', () => {
    expect(report.folders.singleItem[0]?.path).toBe('/Bookmarks bar/JS');
  });

  it('separates untitled from vague titles', () => {
    expect(report.naming.untitled).toBe(1);
    // "read later" is a placeholder; "A" is too short to mean anything.
    expect(report.naming.vague).toBe(2);
    expect(report.naming.samples).toHaveLength(3);
  });

  it('buckets bookmarks by age', () => {
    expect(report.age.olderThan1Year).toBe(3);
    expect(report.age.olderThan3Years).toBe(2);
    expect(report.age.olderThan5Years).toBe(1);
    expect(report.age.oldestAddedAt).toBe(NOW - YEAR * 6);
  });

  it('reports engagement as unavailable when history was not granted', () => {
    expect(report.engagement.historyAvailable).toBe(false);
    expect(report.engagement.neverRevisited).toBe(0);
  });

  it('uses history when it is granted', () => {
    const withHistory = buildCleanupReport({
      nodes,
      now: NOW,
      history: [
        { url: 'https://example.com', visitCount: 40, lastVisitAt: NOW - 1000 },
        { url: 'https://a.com', visitCount: 1, lastVisitAt: NOW - YEAR * 2 },
      ],
    });
    expect(withHistory.engagement.historyAvailable).toBe(true);
    // 3 example.com nodes are well visited; the other 3 bookmarks are not.
    expect(withHistory.engagement.neverRevisited).toBe(3);
    expect(withHistory.engagement.notVisitedIn1Year).toBe(3);
  });

  it('produces the CTA number', () => {
    // 2 wasted dupes + 2 empty + 1 single-item + 1 similar-name surplus + 1 untitled + 2 vague
    expect(report.issueCount).toBe(9);
  });

  it('handles an empty tree without throwing', () => {
    const empty = buildCleanupReport({ nodes: [], now: NOW });
    expect(empty.totals.bookmarks).toBe(0);
    expect(empty.issueCount).toBe(0);
    expect(empty.folders.dumpingGround).toBeNull();
  });

  it('detects a dumping ground', () => {
    const many: BrowserNode[] = [
      {
        id: '0',
        title: '',
        children: [
          {
            id: '1',
            title: 'Bookmarks bar',
            children: Array.from({ length: 40 }, (_, i) => ({
              id: `b${i}`,
              title: `Item ${i}`,
              url: `https://site${i}.dev/page`,
              dateAdded: NOW - 1000,
            })),
          },
        ],
      },
    ];
    const big = buildCleanupReport({ nodes: flattenTree(many), now: NOW });
    expect(big.folders.dumpingGround?.id).toBe('1');
    expect(big.folders.dumpingGround?.bookmarkCount).toBe(40);
  });

  it('stays fast on a large tree', () => {
    const large: BrowserNode[] = [
      {
        id: '0',
        title: '',
        children: [
          {
            id: 'root',
            title: 'Bookmarks bar',
            children: Array.from({ length: 50 }, (_, f) => ({
              id: `f${f}`,
              title: `Folder ${f}`,
              children: Array.from({ length: 100 }, (_, b) => ({
                id: `f${f}b${b}`,
                title: `Bookmark ${b}`,
                url: `https://site${f}.dev/page/${b}?utm_source=test`,
                dateAdded: NOW - b * 1000,
              })),
            })),
          },
        ],
      },
    ];
    const flat = flattenTree(large);
    const started = Date.now();
    const result = buildCleanupReport({ nodes: flat, now: NOW });
    const elapsed = Date.now() - started;
    expect(result.totals.bookmarks).toBe(5000);
    // The popup renders this synchronously; a second is the hard ceiling.
    expect(elapsed).toBeLessThan(1000);
  });
});
