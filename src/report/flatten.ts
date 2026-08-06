import type { BrowserNode, FlatNode } from '../types/index.js';

/**
 * `chrome.bookmarks.getTree()` returns a synthetic root (id `0`, no title, no
 * url) wrapping "Bookmarks bar", "Other bookmarks" and friends. Depth is only
 * meaningful once that wrapper is removed, so the real roots land at depth 0.
 */
function unwrapRoots(nodes: BrowserNode[]): BrowserNode[] {
  if (nodes.length !== 1) return nodes;
  const root = nodes[0];
  if (!root) return nodes;
  const isSynthetic = root.url === undefined && root.title === '' && Array.isArray(root.children);
  return isSynthetic ? (root.children ?? []) : nodes;
}

export function flattenTree(nodes: BrowserNode[], unwrap = true): FlatNode[] {
  const out: FlatNode[] = [];
  const roots = unwrap ? unwrapRoots(nodes) : nodes;

  const walk = (node: BrowserNode, parentId: string | null, depth: number, index: number): void => {
    out.push({
      id: node.id,
      parentId,
      title: node.title ?? '',
      url: node.url ?? null,
      dateAdded: node.dateAdded ?? null,
      depth,
      index: node.index ?? index,
    });
    const children = node.children ?? [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child) walk(child, node.id, depth + 1, i);
    }
  };

  for (let i = 0; i < roots.length; i++) {
    const root = roots[i];
    if (root) walk(root, null, 0, i);
  }

  return out;
}
