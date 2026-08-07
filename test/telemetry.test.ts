import { describe, expect, it } from 'vitest';

import {
  MAX_TELEMETRY_EVENTS,
  telemetryBatchSchema,
  telemetryEventNameSchema,
  telemetryLabelValues,
  telemetryMeasures,
} from '../src/schemas/telemetry.js';

/**
 * The telemetry ingest is unauthenticated by necessity — the activation funnel
 * is mostly pre-sign-in, and gating it would measure only the users who already
 * converted. Its defence is therefore entirely in this shape, which makes these
 * tests security tests rather than validation tests.
 */
const event = (name: string, attributes: Record<string, unknown> = {}) => ({
  client: 'extension' as const,
  events: [{ name, attributes, at: Date.now() }],
});

describe('telemetry batch schema', () => {
  it('accepts a well-formed batch', () => {
    const parsed = telemetryBatchSchema.parse(
      event('report.generated', { size: '1k-5k', durationMs: 56, historyAvailable: false }),
    );
    expect(parsed.events).toHaveLength(1);
  });

  it('caps batch size', () => {
    const events = Array.from({ length: MAX_TELEMETRY_EVENTS + 1 }, () => ({
      name: 'popup.opened',
      attributes: {},
      at: Date.now(),
    }));
    // A batch this large is a client bug or an attack. Neither deserves service.
    expect(() => telemetryBatchSchema.parse({ client: 'extension', events })).toThrow();
  });

  it('rejects an unknown client', () => {
    expect(() => telemetryBatchSchema.parse({ client: 'curl', events: [] })).toThrow();
  });

  /**
   * Deliberately permissive: an unknown event name parses here and is dropped
   * by the server. A newer extension emitting an event this API has not heard
   * of must not have its whole batch refused — the other events in it are still
   * true, and users sit on stale builds for weeks in both directions.
   */
  it('parses an unknown event name so the server can drop just that one', () => {
    expect(() => telemetryBatchSchema.parse(event('report.invented_later'))).not.toThrow();
    expect(telemetryEventNameSchema.safeParse('report.invented_later').success).toBe(false);
  });

  it('bounds attribute keys and string values', () => {
    expect(() => telemetryBatchSchema.parse(event('popup.opened', { ['k'.repeat(41)]: 1 }))).toThrow();
    expect(() => telemetryBatchSchema.parse(event('popup.opened', { size: 'x'.repeat(65) }))).toThrow();
  });

  it('rejects an attribute value that is not a scalar', () => {
    // Objects and arrays have no bounded string form, so they have no business
    // anywhere near a metric label.
    expect(() => telemetryBatchSchema.parse(event('popup.opened', { size: { a: 1 } }))).toThrow();
    expect(() => telemetryBatchSchema.parse(event('popup.opened', { size: ['a'] }))).toThrow();
  });
});

describe('the label allowlist', () => {
  it('keeps every label to a small closed set', () => {
    // The point of the allowlist is bounded cardinality. If a label ever grows
    // an open-ended value list, this is the test that should have caught it.
    for (const [label, values] of Object.entries(telemetryLabelValues)) {
      expect(values.length, `${label} has too many values to be a safe label`).toBeLessThanOrEqual(
        12,
      );
      expect(new Set(values).size, `${label} has duplicate values`).toBe(values.length);
    }
  });

  it('keeps labels and measures disjoint', () => {
    // A name that is both would be recorded twice and mean two things.
    const labels = new Set(Object.keys(telemetryLabelValues));
    for (const measure of telemetryMeasures) {
      expect(labels.has(measure), `${measure} is both a label and a measure`).toBe(false);
    }
  });
});
