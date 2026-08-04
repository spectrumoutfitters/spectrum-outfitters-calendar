import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildTicketSplitPlan } from '../src/lib/ticketSplitPlan.js';

const pools = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('buildTicketSplitPlan', () => {
  it('returns null when there are no pools', () => {
    assert.equal(buildTicketSplitPlan({}, [], 10), null);
  });

  it('equal-splits across all pools and gives remainder to the last', () => {
    const plan = buildTicketSplitPlan({}, pools, 10);
    assert.equal(plan.evenly, true);
    assert.deepEqual(plan.poolIds, ['a', 'b', 'c']);
    const weights = plan.rows.map((r) => r.weight);
    assert.equal(weights[0], 10 / 3);
    assert.equal(weights[1], 10 / 3);
    assert.equal(weights[2], 10 - 20 / 3);
    assert.ok(Math.abs(weights.reduce((s, w) => s + w, 0) - 10) < 1e-9);
  });

  it('equal-splits a selected subset and dedupes ids', () => {
    const plan = buildTicketSplitPlan(
      { splitRaffleIds: ['a', 'a', 'c', ''] },
      pools,
      5
    );
    assert.deepEqual(plan.poolIds, ['a', 'c']);
    assert.equal(plan.rows.length, 2);
    assert.equal(plan.rows[0].weight, 2.5);
    assert.equal(plan.rows[1].weight, 2.5);
  });

  it('rejects unknown pool ids and single-pool splits', () => {
    assert.throws(
      () => buildTicketSplitPlan({ splitRaffleIds: ['a', 'nope'] }, pools, 4),
      /Invalid pool/
    );
    assert.throws(
      () => buildTicketSplitPlan({ splitRaffleIds: ['a'] }, pools, 4),
      /at least two prize pools/
    );
  });

  it('accepts custom ticketSplit within tolerance', () => {
    const plan = buildTicketSplitPlan(
      {
        splitEvenly: false,
        ticketSplit: { a: 4, b: 3, c: 3 },
      },
      pools,
      10
    );
    assert.equal(plan.evenly, false);
    assert.deepEqual(plan.poolIds, ['a', 'b', 'c']);
    assert.equal(plan.rows.find((r) => r.raffleId === 'a').weight, 4);
  });

  it('rejects custom splits that do not sum to totalEntries', () => {
    assert.throws(
      () =>
        buildTicketSplitPlan(
          { splitEvenly: false, ticketSplit: { a: 1, b: 1, c: 1 } },
          pools,
          10
        ),
      /add up to your total/
    );
  });

  it('returns null for all-zero custom splits that sum to zero total', () => {
    const plan = buildTicketSplitPlan(
      { splitEvenly: false, ticketSplit: { a: 0, b: 0, c: 0 } },
      pools,
      0
    );
    assert.equal(plan, null);
  });
});
