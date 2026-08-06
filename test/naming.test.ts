import { describe, expect, it } from 'vitest';
import {
  editDistance,
  isUntitled,
  isVagueTitle,
  normalizeFolderName,
  titleEqualsUrl,
} from '../src/report/naming.js';

describe('normalizeFolderName', () => {
  it('collapses the JS family', () => {
    const key = normalizeFolderName('JS');
    expect(normalizeFolderName('Javascript')).toBe(key);
    expect(normalizeFolderName('JS Stuff')).toBe(key);
    expect(normalizeFolderName('js  ')).toBe(key);
  });

  it('ignores word order and punctuation', () => {
    expect(normalizeFolderName('Design & UI')).toBe(normalizeFolderName('UI / Design'));
  });

  it('returns empty for pure filler', () => {
    expect(normalizeFolderName('Misc Stuff')).toBe('');
    expect(normalizeFolderName('   ')).toBe('');
  });

  it('keeps genuinely different names apart', () => {
    expect(normalizeFolderName('Finance')).not.toBe(normalizeFolderName('Travel'));
  });
});

describe('isVagueTitle', () => {
  it('flags placeholder titles', () => {
    expect(isVagueTitle('Read Later', 'https://x.dev')).toBe(true);
    expect(isVagueTitle('untitled', 'https://x.dev')).toBe(true);
    expect(isVagueTitle('ab', 'https://x.dev')).toBe(true);
    expect(isVagueTitle('https://x.dev', 'https://x.dev')).toBe(true);
  });

  it('leaves real titles alone', () => {
    expect(isVagueTitle('Postgres HNSW index tuning', 'https://x.dev')).toBe(false);
  });

  it('does not double-count untitled', () => {
    expect(isVagueTitle('', 'https://x.dev')).toBe(false);
    expect(isUntitled('   ')).toBe(true);
  });
});

describe('titleEqualsUrl', () => {
  it('matches with or without the scheme', () => {
    expect(titleEqualsUrl('https://x.dev/a', 'https://x.dev/a')).toBe(true);
    expect(titleEqualsUrl('x.dev/a', 'https://x.dev/a')).toBe(true);
    expect(titleEqualsUrl('Real title', 'https://x.dev/a')).toBe(false);
  });
});

describe('editDistance', () => {
  it('measures small edits', () => {
    expect(editDistance('frontend', 'front end')).toBe(1);
    expect(editDistance('kitten', 'sitting', 5)).toBe(3);
    expect(editDistance('same', 'same')).toBe(0);
  });

  it('bails out past the ceiling', () => {
    expect(editDistance('abc', 'zzzzzzzzzz', 2)).toBe(3);
  });
});
