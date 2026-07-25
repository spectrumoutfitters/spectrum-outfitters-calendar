import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  countPositivePools,
  defaultPoolTickets,
  emptyPoolTickets,
  maxTicketsForPool,
  reconcilePoolTickets,
  sumPoolTickets
} from '../src/lib/poolTicketAlloc.ts';

describe('poolTicketAlloc', () => {
  it('builds empty and default first-pool allocations', () => {
    assert.deepEqual(emptyPoolTickets(['a', 'b']), { a: 0, b: 0 });
    assert.deepEqual(defaultPoolTickets(['a', 'b'], 7.9), { a: 7, b: 0 });
    assert.deepEqual(defaultPoolTickets(['a', 'b'], -3), { a: 0, b: 0 });
    assert.deepEqual(defaultPoolTickets([], 5), {});
  });

  it('reconciles upward by adding the shortfall to the first pool', () => {
    const out = reconcilePoolTickets(['a', 'b'], { a: 1, b: 2 }, 10);
    assert.deepEqual(out, { a: 8, b: 2 });
    assert.equal(sumPoolTickets(['a', 'b'], out), 10);
  });

  it('reconciles downward by trimming from the last pools first', () => {
    const out = reconcilePoolTickets(['a', 'b', 'c'], { a: 5, b: 4, c: 3 }, 6);
    assert.deepEqual(out, { a: 5, b: 1, c: 0 });
    assert.equal(sumPoolTickets(['a', 'b', 'c'], out), 6);
  });

  it('assigns the full target to the first pool when previous sum is zero', () => {
    assert.deepEqual(
      reconcilePoolTickets(['a', 'b'], { a: 0, b: 0 }, 4),
      { a: 4, b: 0 }
    );
  });

  it('zeros all pools when target total is zero', () => {
    assert.deepEqual(
      reconcilePoolTickets(['a', 'b'], { a: 2, b: 3 }, 0),
      { a: 0, b: 0 }
    );
  });

  it('floors invalid previous values and ignores unknown pool ids', () => {
    const out = reconcilePoolTickets(['a', 'b'], { a: '3.8', b: 'nope', c: 99 }, 5);
    assert.deepEqual(out, { a: 5, b: 0 });
  });

  it('caps a pool so overall preview total is not exceeded', () => {
    const poolTickets = { a: 2, b: 3 };
    assert.equal(maxTicketsForPool('a', ['a', 'b'], poolTickets, 10), 7);
    assert.equal(maxTicketsForPool('b', ['a', 'b'], poolTickets, 4), 2);
    assert.equal(countPositivePools(['a', 'b', 'c'], { a: 1, b: 0, c: 2 }), 2);
  });
});
