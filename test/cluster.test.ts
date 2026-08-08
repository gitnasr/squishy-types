import { describe, expect, it } from 'vitest';

import { clusterByTitle } from '../src/classify/cluster.js';
import type { ClassifiableBookmark } from '../src/types/index.js';

/**
 * Clustering sits between the rules and the LLM, and everything it produces
 * becomes a folder someone is asked to approve.
 *
 * So the tests are mostly about restraint: what it declines to group. A
 * confident wrong folder is worse than no folder, because the user has to undo
 * it — and the whole promise is that nothing moves without their say-so.
 */
const at = (id: string, title: string, url = `https://example${id}.test/page`): ClassifiableBookmark => ({
  id,
  title,
  url,
});

describe('clusterByTitle', () => {
  it('groups bookmarks sharing a distinctive word', () => {
    const bookmarks = [
      at('1', 'Kubernetes networking explained'),
      at('2', 'Debugging kubernetes pods'),
      at('3', 'Kubernetes operators in depth'),
      at('4', 'Scaling kubernetes clusters'),
      at('5', 'Kubernetes secrets management'),
      // Padding so the cluster is a real subset. A token carried by most of a
      // collection describes the collection, and the guard against that is
      // deliberate — so the fixture has to look like a real library.
      at('6', 'Sourdough starter recipe'),
      at('7', 'Tomato growing calendar'),
      at('8', 'Piano scales practice'),
      at('9', 'Filing a tax return'),
      at('10', 'Cycling routes near me'),
      at('11', 'Camera lens comparison'),
    ];

    const clusters = clusterByTitle(bookmarks);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.name).toBe('Kubernetes');
    expect(clusters[0]!.bookmarkIds).toHaveLength(5);
    // The unrelated one is left alone rather than swept in.
    expect(clusters[0]!.bookmarkIds).not.toContain('6');
  });

  /** The rationale is the feature: a user can check it, unlike a cosine score. */
  it('explains itself in terms a person can verify', () => {
    const clusters = clusterByTitle([
      ...Array.from({ length: 6 }, (_, i) => at(`r${i}`, `Rust ownership part ${i}`)),
      ...Array.from({ length: 8 }, (_, i) => at(`x${i}`, `Unrelated subject ${i} sourdough piano`)),
    ]);
    expect(clusters[0]!.rationale).toBe('6 bookmarks mention "rust"');
  });

  /**
   * Without stop words the biggest cluster in almost any collection is "how",
   * and a folder called "How" is worse than no folder.
   */
  it('never forms a cluster from question or filler words', () => {
    const clusters = clusterByTitle([
      at('1', 'How to bake bread'),
      at('2', 'How to change a tyre'),
      at('3', 'How to file taxes'),
      at('4', 'How to learn piano'),
      at('5', 'How to write a CV'),
      at('6', 'How to grow tomatoes'),
    ]);
    expect(clusters.map((c) => c.token)).not.toContain('how');
    expect(clusters).toHaveLength(0);
  });

  it('does not cluster on the site name, which groups the host not the topic', () => {
    const clusters = clusterByTitle([
      at('1', 'Reading list', 'https://medium.com/a'),
      at('2', 'Another post', 'https://medium.com/b'),
      at('3', 'Third post', 'https://medium.com/c'),
      at('4', 'Fourth post', 'https://medium.com/d'),
      at('5', 'Fifth post', 'https://medium.com/e'),
      at('6', 'Sixth post', 'https://medium.com/f'),
    ]);
    expect(clusters.map((c) => c.token)).not.toContain('medium');
  });

  /** Spec §6.2: a new category needs five members. A folder of two is sprawl. */
  it('refuses to create a folder of two', () => {
    const clusters = clusterByTitle([
      at('1', 'Kubernetes networking'),
      at('2', 'Kubernetes pods'),
      at('3', 'Sourdough bread'),
      at('4', 'Tomato growing'),
      at('5', 'Piano scales'),
      at('6', 'Tax returns'),
    ]);
    expect(clusters).toHaveLength(0);
  });

  /**
   * A token in almost everything describes the collection, not a subset —
   * clustering on it would put the entire library in one folder and call it
   * organised.
   */
  it('ignores a word that appears in more than half of everything', () => {
    const bookmarks = Array.from({ length: 10 }, (_, i) => at(String(i), `Design notes ${i}`));
    const clusters = clusterByTitle(bookmarks);
    expect(clusters.map((c) => c.token)).not.toContain('design');
  });

  it('puts each bookmark in at most one folder', () => {
    const bookmarks = [
      ...Array.from({ length: 6 }, (_, i) => at(`k${i}`, `Kubernetes helm chart ${i}`)),
      ...Array.from({ length: 6 }, (_, i) => at(`t${i}`, `Terraform module ${i}`)),
    ];

    const clusters = clusterByTitle(bookmarks);
    const seen = new Set<string>();
    for (const cluster of clusters) {
      for (const id of cluster.bookmarkIds) {
        // The browser cannot put one bookmark in two folders, and a filing
        // system that tries is not a filing system.
        expect(seen.has(id), `${id} claimed twice`).toBe(false);
        seen.add(id);
      }
    }
  });

  it('stays below the rule pass in confidence', () => {
    const clusters = clusterByTitle([
      ...Array.from({ length: 8 }, (_, i) => at(`p${i}`, `Postgres indexing ${i}`)),
      ...Array.from({ length: 10 }, (_, i) => at(`o${i}`, `Cycling route ${i} tomato piano`)),
    ]);
    // A shared word is weaker evidence than a known domain, and the review
    // queue reads least-confident-first — these should surface above rules.
    expect(clusters[0]!.confidence).toBeLessThan(0.8);
    expect(clusters[0]!.confidence).toBeGreaterThan(0);
  });

  it('handles empty and tiny collections without inventing groups', () => {
    expect(clusterByTitle([])).toEqual([]);
    expect(clusterByTitle([at('1', 'Only one')])).toEqual([]);
  });

  it('survives titles that are entirely punctuation or empty', () => {
    const clusters = clusterByTitle([
      at('1', ''),
      at('2', '— — —'),
      at('3', '!!!'),
      at('4', ''),
      at('5', '...'),
      at('6', ''),
    ]);
    expect(clusters).toEqual([]);
  });
});
