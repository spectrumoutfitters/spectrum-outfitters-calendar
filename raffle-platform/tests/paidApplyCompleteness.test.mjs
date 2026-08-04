import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  paidPurchaseFullyApplied,
  shouldRewritePartialPaidApply,
  sumPaidTicketsFromRows,
} from '../src/lib/paidApplyCompleteness.js';

const rows = [
  {
    slug: 'event',
    tickets: 5,
    extras: { __stripeSessionId: 'cs_1', __paidTickets: 5 },
  },
  {
    slug: 'event',
    tickets: 3,
    extras: { __stripeSessionId: 'cs_1', __paidTickets: 3 },
  },
];

describe('paid apply completeness', () => {
  it('sums paid tickets for a session', () => {
    assert.equal(sumPaidTicketsFromRows(rows, 'event', 'cs_1'), 8);
    assert.equal(sumPaidTicketsFromRows(rows, 'event', 'cs_other'), 0);
  });

  it('treats partial multi-pool apply as incomplete', () => {
    assert.equal(paidPurchaseFullyApplied(rows.slice(0, 1), 'event', 'cs_1', 8), false);
    assert.equal(shouldRewritePartialPaidApply(rows.slice(0, 1), 'event', 'cs_1', 8), true);
  });

  it('treats full apply as alreadyApplied', () => {
    assert.equal(paidPurchaseFullyApplied(rows, 'event', 'cs_1', 8), true);
    assert.equal(shouldRewritePartialPaidApply(rows, 'event', 'cs_1', 8), false);
  });

  it('does not treat any-row presence alone as complete when expected is higher', () => {
    // Legacy bug: a single pool row made alreadyApplied=true and dropped remaining pools.
    assert.equal(paidPurchaseFullyApplied(rows.slice(0, 1), 'event', 'cs_1', 8), false);
  });
});
