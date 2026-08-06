import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../src/url/sha256.js';

const oracle = (input: string): string =>
  createHash('sha256').update(Buffer.from(input, 'utf8')).digest('hex');

describe('sha256Hex', () => {
  it('matches the published vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('agrees with node:crypto across padding boundaries', () => {
    // 55/56 and 63/64 are where the length field spills into an extra block.
    for (const length of [0, 1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 1000]) {
      const input = 'a'.repeat(length);
      expect(sha256Hex(input), `length ${length}`).toBe(oracle(input));
    }
  });

  it('agrees with node:crypto on multi-byte UTF-8', () => {
    for (const input of ['héllo', '日本語のブックマーク', '👋🏽 emoji', 'ß∂ƒ©˙∆˚¬']) {
      expect(sha256Hex(input), input).toBe(oracle(input));
    }
  });

  it('agrees with node:crypto on random input', () => {
    for (let i = 0; i < 200; i++) {
      const length = Math.floor(Math.random() * 300);
      let input = '';
      for (let j = 0; j < length; j++) {
        input += String.fromCharCode(32 + Math.floor(Math.random() * 90));
      }
      expect(sha256Hex(input)).toBe(oracle(input));
    }
  });

  it('handles a large input', () => {
    const input = 'a'.repeat(1_000_000);
    expect(sha256Hex(input)).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
    );
  });
});
