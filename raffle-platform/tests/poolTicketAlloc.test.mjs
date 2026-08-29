import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  countPositivePools,
  defaultPoolTickets,
  emptyPoolTickets,
  maxTicketsForPool,
  reconcilePoolTickets,
  sumPoolTickets,
} from '../src/lib/poolTicketAlloc.ts';

const IDS = ['pool_a', 'pool_b', 'pool_c'];

describe('emptyPoolTickets / defaultPoolTickets', () => {
  it('zeros every ordered id', () => {
    assert.deepEqual(emptyPoolTickets(IDS), { pool_a: 0, pool_b: 0, pool_c: 0 });
    assert.deepEqual(emptyPoolTickets([]), {});
  });

  it('puts a floored non-negative total on the first pool only', () => {
    assert.deepEqual(defaultPoolTickets(IDS, 7), { pool_a: 7, pool_b: 0, pool_c: 0 });
    assert.deepEqual(defaultPoolTickets(IDS, 2.9), { pool_a: 2, pool_b: 0, pool_c: 0 });
    assert.deepEqual(defaultPoolTickets(IDS, 0), { pool_a: 0, pool_b: 0, pool_c: 0 });
    assert.deepEqual(defaultPoolTickets(IDS, -4), { pool_a: 0, pool_b: 0, pool_c: 0 });
    assert.deepEqual(defaultPoolTickets([], 10), {});
  });
});

describe('reconcilePoolTickets', () => {
  it('assigns the full target to the first pool when nothing is allocated', () => {
    assert.deepEqual(reconcilePoolTickets(IDS, {}, 5), {
      pool_a: 5,
      pool_b: 0,
      pool_c: 0,
    });
  });

  it('adds a ticket shortfall onto the first pool', () => {
    assert.deepEqual(
      reconcilePoolTickets(IDS, { pool_a: 1, pool_b: 1, pool_c: 1 }, 5),
      { pool_a: 3, pool_b: 1, pool_c: 1 },
    );
  });

  it('cuts overflow from the last pool first', () => {
    assert.deepEqual(
      reconcilePoolTickets(IDS, { pool_a: 2, pool_b: 2, pool_c: 2 }, 3),
      { pool_a: 2, pool_b: 1, pool_c: 0 },
    );
  });

  it('zeros every pool when target is 0 and floors NaN/negatives', () => {
    assert.deepEqual(
      reconcilePoolTickets(IDS, { pool_a: 4, pool_b: -2, pool_c: 'x' }, 0),
      { pool_a: 0, pool_b: 0, pool_c: 0 },
    );
    assert.deepEqual(
      reconcilePoolTickets(IDS, { pool_a: -9, pool_b: 1.9, pool_c: NaN }, 3),
      { pool_a: 2, pool_b: 1, pool_c: 0 },
    );
  });

  it('returns an empty object when there are no pool ids', () => {
    assert.deepEqual(reconcilePoolTickets([], { pool_a: 3 }, 10), {});
  });
});

describe('sum / max / count helpers', () => {
  it('sums only ordered ids and treats non-numeric as 0', () => {
    assert.equal(sumPoolTickets(IDS, { pool_a: 2, pool_b: '3', pool_c: 'nope' }), 5);
    assert.equal(sumPoolTickets(IDS, { pool_a: 2, extra: 99 }), 2);
  });

  it('caps a pool so the overall sum cannot exceed previewTotal', () => {
    const tickets = { pool_a: 2, pool_b: 1, pool_c: 0 };
    assert.equal(maxTicketsForPool('pool_c', IDS, tickets, 5), 2);
    assert.equal(maxTicketsForPool('pool_a', IDS, tickets, 5), 4);
    assert.equal(maxTicketsForPool('pool_b', IDS, tickets, 2), 0);
  });

  it('counts only pools with a positive numeric ticket total', () => {
    assert.equal(
      countPositivePools(IDS, { pool_a: 1, pool_b: 0, pool_c: -3 }),
      1,
    );
    assert.equal(countPositivePools(IDS, { pool_a: '2', pool_b: 'x', pool_c: 0.5 }), 2);
  });
});
