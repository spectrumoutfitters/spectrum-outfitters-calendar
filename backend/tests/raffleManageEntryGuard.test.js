import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTicketSplitPlan,
  evaluateManageEntrySplitPlan,
  freeTicketsForManageUpdate,
} from '../utils/raffleManageEntryGuard.js';

describe('freeTicketsForManageUpdate', () => {
  it('adds preserved newsletter bonus to bonus/base tickets', () => {
    assert.equal(
      freeTicketsForManageUpdate({
        bonusTickets: 2,
        newsletterOptIn: true,
        newsletterBonusTickets: 2,
      }),
      4,
    );
  });

  it('does not add newsletter tickets when opt-in is off', () => {
    assert.equal(
      freeTicketsForManageUpdate({
        bonusTickets: 2,
        newsletterOptIn: false,
        newsletterBonusTickets: 2,
      }),
      2,
    );
  });
});

describe('evaluateManageEntrySplitPlan (pre-delete gate)', () => {
  const raffleIds = ['pool-a', 'pool-b'];

  it('rejects manage-entry split that omits newsletter tickets (must not delete rows)', () => {
    const totalEntries = freeTicketsForManageUpdate({
      bonusTickets: 2,
      newsletterOptIn: true,
      newsletterBonusTickets: 2,
    });
    const result = evaluateManageEntrySplitPlan({
      ticketMode: 'split',
      raffleIds,
      splitEvenly: false,
      ticketSplit: { 'pool-a': 1, 'pool-b': 1 },
      totalEntries,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'split');
    assert.match(result.error, /add up to your total \(4\)/);
  });

  it('accepts a split that includes newsletter tickets', () => {
    const totalEntries = freeTicketsForManageUpdate({
      bonusTickets: 2,
      newsletterOptIn: true,
      newsletterBonusTickets: 2,
    });
    const result = evaluateManageEntrySplitPlan({
      ticketMode: 'split',
      raffleIds,
      splitEvenly: false,
      ticketSplit: { 'pool-a': 2, 'pool-b': 2 },
      totalEntries,
    });
    assert.equal(result.ok, true);
    assert.equal(result.plan.rows.reduce((s, r) => s + r.weight, 0), 4);
  });

  it('allows single-pool updates without a split plan', () => {
    const result = evaluateManageEntrySplitPlan({
      ticketMode: 'single',
      raffleIds,
      splitEvenly: false,
      ticketSplit: { 'pool-a': 2 },
      totalEntries: 4,
    });
    assert.equal(result.ok, true);
  });

  it('rejects custom split that does not sum to totalEntries', () => {
    const result = evaluateManageEntrySplitPlan({
      ticketMode: 'split',
      raffleIds,
      splitEvenly: false,
      ticketSplit: { 'pool-a': 0, 'pool-b': 0 },
      totalEntries: 2,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'split');
  });
});

describe('buildTicketSplitPlan', () => {
  it('evenly splits when splitEvenly is not false', () => {
    const plan = buildTicketSplitPlan({
      raffleIds: ['a', 'b'],
      totalEntries: 4,
    });
    assert.equal(plan.evenly, true);
    assert.equal(plan.rows[0].weight, 2);
    assert.equal(plan.rows[1].weight, 2);
  });
});
