import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('linearSlope (used by forecast)', () => {
  it('computes correct slope for increasing values', () => {
    // y = 2x: [0, 2, 4, 6] → slope = 2
    const values = [0, 2, 4, 6];
    const slope = linearSlope(values);
    assert.ok(Math.abs(slope - 2) < 0.001, `expected ~2, got ${slope}`);
  });

  it('computes zero slope for flat values', () => {
    const values = [100, 100, 100, 100];
    const slope = linearSlope(values);
    assert.ok(Math.abs(slope) < 0.001, `expected ~0, got ${slope}`);
  });

  it('returns 0 for single value', () => {
    const slope = linearSlope([42]);
    assert.equal(slope, 0);
  });

  it('returns 0 for empty array', () => {
    const slope = linearSlope([]);
    assert.equal(slope, 0);
  });
});

function linearSlope(values) {
  const n = values.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}
