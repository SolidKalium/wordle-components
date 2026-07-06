import { describe, expect, it } from 'vitest';
import { createScrollMetrics } from '../src/ui/html/components/BruteForceList.jsx';

describe('BruteForceList compressed scroll coordinates', () => {
  it('keeps a blank five-letter search below browser height limits', () => {
    const rowCount = Math.ceil(26 ** 5 / 5);
    const metrics = createScrollMetrics(rowCount);

    expect(metrics.logicalHeight).toBeGreaterThan(16_777_216);
    expect(metrics.physicalHeight).toBe(8_000_000);
    expect(metrics.scale).toBeGreaterThan(1);
  });

  it('maps the physical scrollbar bottom to the logical list bottom', () => {
    const metrics = createScrollMetrics(Math.ceil(26 ** 5 / 5));
    expect(metrics.physicalMax * metrics.scale).toBeCloseTo(metrics.logicalMax, 5);
  });

  it('does not compress lists that fit naturally', () => {
    const metrics = createScrollMetrics(100);
    expect(metrics.scale).toBe(1);
    expect(metrics.physicalHeight).toBe(metrics.logicalHeight);
  });
});
