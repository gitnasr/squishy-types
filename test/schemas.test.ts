import { describe, expect, it } from 'vitest';
import {
  IMPORT_BATCH_SIZE,
  flatNodeSchema,
  syncChangesRequestSchema,
  syncImportRequestSchema,
} from '../src/schemas/index.js';
import { MIN_SUPPORTED_PROTOCOL, PROTOCOL_VERSION, isProtocolSupported } from '../src/protocol.js';

const validNode = {
  id: '10',
  parentId: '1',
  title: 'Example',
  url: 'https://example.com',
  dateAdded: 1_700_000_000_000,
  depth: 1,
  index: 0,
};

describe('flatNodeSchema', () => {
  it('accepts a real node', () => {
    expect(flatNodeSchema.parse(validNode)).toEqual(validNode);
  });

  it('accepts folders (null url)', () => {
    expect(flatNodeSchema.parse({ ...validNode, url: null }).url).toBeNull();
  });

  it('rejects a hostile title length', () => {
    expect(flatNodeSchema.safeParse({ ...validNode, title: 'x'.repeat(5000) }).success).toBe(false);
  });

  it('rejects a missing depth', () => {
    const { depth: _depth, ...rest } = validNode;
    expect(flatNodeSchema.safeParse(rest).success).toBe(false);
  });
});

describe('syncImportRequestSchema', () => {
  it('caps the batch size', () => {
    const nodes = Array.from({ length: IMPORT_BATCH_SIZE + 1 }, () => validNode);
    const result = syncImportRequestSchema.safeParse({
      deviceId: null,
      deviceLabel: 'Windows Chrome',
      batchIndex: 0,
      batchCount: 1,
      nodes,
    });
    expect(result.success).toBe(false);
  });
});

describe('syncChangesRequestSchema', () => {
  it('requires a UUID device id', () => {
    const result = syncChangesRequestSchema.safeParse({
      deviceId: 'not-a-uuid',
      cursor: 0,
      changes: [],
    });
    expect(result.success).toBe(false);
  });

  it('accepts an empty flush', () => {
    const result = syncChangesRequestSchema.safeParse({
      deviceId: '6f1d1f9a-2b3c-4d5e-8f90-123456789abc',
      cursor: 12,
      changes: [],
    });
    expect(result.success).toBe(true);
  });
});

describe('protocol', () => {
  it('accepts the current version', () => {
    expect(isProtocolSupported(PROTOCOL_VERSION)).toBe(true);
    expect(isProtocolSupported(MIN_SUPPORTED_PROTOCOL)).toBe(true);
  });

  it('rejects anything outside the window', () => {
    expect(isProtocolSupported(MIN_SUPPORTED_PROTOCOL - 1)).toBe(false);
    expect(isProtocolSupported(PROTOCOL_VERSION + 1)).toBe(false);
    expect(isProtocolSupported(1.5)).toBe(false);
  });
});
