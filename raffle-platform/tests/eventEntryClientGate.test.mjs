import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCheckoutError,
  isNewsletterBonusShown,
  isPaidTicketsUiEnabled,
  newsletterOptInForSubmit,
  validateEntryPoolSplit,
} from '../src/lib/eventEntryClientGate.js';

describe('isPaidTicketsUiEnabled', () => {
  it('requires a truthy flag, a positive price, and non-test mode', () => {
    assert.equal(
      isPaidTicketsUiEnabled({ paidTicketsEnabled: true, ticketPriceCents: 500, testMode: false }),
      true
    );
    assert.equal(
      isPaidTicketsUiEnabled({ paidTicketsEnabled: 1, ticketPriceCents: '250', testMode: false }),
      true
    );
  });

  it('hides paid UI when disabled, free, or in test mode', () => {
    assert.equal(
      isPaidTicketsUiEnabled({ paidTicketsEnabled: false, ticketPriceCents: 500, testMode: false }),
      false
    );
    assert.equal(
      isPaidTicketsUiEnabled({ paidTicketsEnabled: true, ticketPriceCents: 0, testMode: false }),
      false
    );
    assert.equal(
      isPaidTicketsUiEnabled({ paidTicketsEnabled: true, ticketPriceCents: -10, testMode: false }),
      false
    );
    assert.equal(
      isPaidTicketsUiEnabled({ paidTicketsEnabled: true, ticketPriceCents: 500, testMode: true }),
      false
    );
  });
});

describe('isNewsletterBonusShown / newsletterOptInForSubmit', () => {
  it('shows only when enabled is not boolean false and tickets floor to >= 1', () => {
    assert.equal(isNewsletterBonusShown(undefined, 2), true);
    assert.equal(isNewsletterBonusShown(0, 2), true);
    assert.equal(isNewsletterBonusShown(false, 2), false);
    assert.equal(isNewsletterBonusShown(true, 0), false);
    assert.equal(isNewsletterBonusShown(true, 0.9), false);
    assert.equal(isNewsletterBonusShown(true, '3'), true);
  });

  it('never submits opt-in when the bonus is hidden', () => {
    assert.equal(newsletterOptInForSubmit(true, true), true);
    assert.equal(newsletterOptInForSubmit(true, 1), true);
    assert.equal(newsletterOptInForSubmit(false, true), false);
    assert.equal(newsletterOptInForSubmit(false, false), false);
  });
});

describe('validateEntryPoolSplit', () => {
  it('requires at least one positive pool, matching preview total, and terms', () => {
    assert.match(
      validateEntryPoolSplit({ positivePools: 0, poolSum: 0, previewTickets: 2, termsAccepted: true }),
      /at least one ticket/
    );
    assert.match(
      validateEntryPoolSplit({ positivePools: 1, poolSum: 1, previewTickets: 2, termsAccepted: true }),
      /add up to 2 \(you have 1 assigned\)/
    );
    assert.match(
      validateEntryPoolSplit({ positivePools: 1, poolSum: 2, previewTickets: 2, termsAccepted: false }),
      /official rules and terms/
    );
    assert.equal(
      validateEntryPoolSplit({ positivePools: 1, poolSum: 2, previewTickets: 2, termsAccepted: true }),
      null
    );
  });
});

describe('formatCheckoutError', () => {
  it('maps known Stripe checkout codes and max_* leftovers', () => {
    assert.equal(formatCheckoutError('entry_locked'), 'This entry is locked because a draw is too close.');
    assert.equal(formatCheckoutError('must_buy_at_least_one'), 'Pick at least one ticket before checking out.');
    assert.equal(formatCheckoutError('max_10'), 'max 10');
    assert.equal(formatCheckoutError(undefined), "We couldn't open Stripe right now.");
    assert.equal(formatCheckoutError('other'), "We couldn't open Stripe right now.");
  });
});
