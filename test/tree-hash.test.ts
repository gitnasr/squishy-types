import { describe, expect, it } from 'vitest';

import type { FlatNode } from '../src/types/index.js';
import { treeHash, treeSize } from '../src/sync/tree-hash.js';

const node = (over: Partial<FlatNode>): FlatNode => ({
  id: '1',
  parentId: null,
  title: 'Title',
  url: null,
  dateAdded: 1_700_000_000_000,
  depth: 0,
  index: 0,
  ...over,
});

const tree: FlatNode[] = [
  node({ id: '1', title: 'Bar' }),
  node({ id: '10', parentId: '1', title: 'Example', url: 'https://example.com', index: 0 }),
  node({ id: '11', parentId: '1', title: 'Other', url: 'https://other.dev', index: 1 }),
];

describe('treeHash', () => {
  it('is stable across runs', () => {
    expect(treeHash(tree)).toBe(treeHash(tree));
  });

  it('does not depend on traversal order', () => {
    // Sibling order is carried by `index`; depending on array order would make
    // the hash a property of how the tree was walked.
    expect(treeHash([...tree].reverse())).toBe(treeHash(tree));
  });

  it('changes when a bookmark moves to a different parent', () => {
    const moved = tree.map((n) => (n.id === '10' ? { ...n, parentId: '2' } : n));
    expect(treeHash(moved)).not.toBe(treeHash(tree));
  });

  it('changes when siblings are reordered', () => {
    const reordered = tree.map((n) => (n.id === '10' ? { ...n, index: 5 } : n));
    expect(treeHash(reordered)).not.toBe(treeHash(tree));
  });

  it('changes when a title changes', () => {
    const renamed = tree.map((n) => (n.id === '10' ? { ...n, title: 'Renamed' } : n));
    expect(treeHash(renamed)).not.toBe(treeHash(tree));
  });

  it('ignores tracking parameters, because the server stores the canonical url', () => {
    // Otherwise every bookmark carrying a utm_ tag would report drift forever.
    const tracked = tree.map((n) =>
      n.id === '10' ? { ...n, url: 'https://www.example.com/?utm_source=x' } : n,
    );
    expect(treeHash(tracked)).toBe(treeHash(tree));
  });

  it('ignores dateAdded and depth', () => {
    // The server rewrites timestamps on touch, and depth is derived from
    // parentId. Hashing either reports drift when nothing the user did changed.
    const noisy = tree.map((n) => ({ ...n, dateAdded: 1, depth: 99 }));
    expect(treeHash(noisy)).toBe(treeHash(tree));
  });

  it('distinguishes a folder from a bookmark with an empty url', () => {
    const asBookmark = tree.map((n) => (n.id === '1' ? { ...n, url: 'https://a.dev' } : n));
    expect(treeHash(asBookmark)).not.toBe(treeHash(tree));
  });

  it('counts bookmarks and folders separately', () => {
    expect(treeSize(tree)).toEqual({ bookmarks: 2, folders: 1 });
  });

  it('handles an empty tree', () => {
    expect(treeHash([])).toHaveLength(64);
    expect(treeSize([])).toEqual({ bookmarks: 0, folders: 0 });
  });
});
