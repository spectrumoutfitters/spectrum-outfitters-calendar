import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBaseTickets,
  normalizeNewsletterBonus,
  paidTicketPriceCents,
  paidTicketsCheckoutEnabled,
  paidTicketsManageEnabled,
  paidTicketsMaxPerPurchase,
  newsletterShowsBonus,
  previewEntryTickets,
} from '../src/lib/entryTicketPreview.js';

describe('normalizeBaseTickets', () => {
  it('defaults omitted/0/NaN to 2 and clamps negatives to 1', () => {
    assert.equal(normalizeBaseTickets(undefined), 2);
    assert.equal(normalizeBaseTickets(0), 2);
    assert.equal(normalizeBaseTickets('abc'), 2);
    assert.equal(normalizeBaseTickets(-3), 1);
    assert.equal(normalizeBaseTickets(4.9), 4);
  });
});

describe('normalizeNewsletterBonus / paidTicketPriceCents', () => {
  it('floors and clamps at 0', () => {
    assert.equal(normalizeNewsletterBonus(undefined), 0);
    assert.equal(normalizeNewsletterBonus(-2), 0);
    assert.equal(normalizeNewsletterBonus(2.8), 2);
    assert.equal(paidTicketPriceCents(199.9), 199);
    assert.equal(paidTicketPriceCents('abc'), 0);
  });
});

describe('paidTicketsMaxPerPurchase', () => {
  it('defaults to 100 and never goes below 1', () => {
    assert.equal(paidTicketsMaxPerPurchase(undefined), 100);
    assert.equal(paidTicketsMaxPerPurchase(0), 100);
    assert.equal(paidTicketsMaxPerPurchase(-5), 1);
    assert.equal(paidTicketsMaxPerPurchase(25), 25);
  });
});

describe('paidTicketsCheckoutEnabled vs paidTicketsManageEnabled', () => {
  it('hides checkout in test mode even when paid tickets are configured', () => {
    const args = { paidTicketsEnabled: true, ticketPriceCents: 500, testMode: true };
    assert.equal(paidTicketsCheckoutEnabled(args), false);
    assert.equal(paidTicketsManageEnabled(args), false);
  });

  it('hides checkout when paid tickets are off or price is 0', () => {
    assert.equal(
      paidTicketsCheckoutEnabled({ paidTicketsEnabled: false, ticketPriceCents: 500, testMode: false }),
      false,
    );
    assert.equal(
      paidTicketsCheckoutEnabled({ paidTicketsEnabled: true, ticketPriceCents: 0, testMode: false }),
      false,
    );
  });

  it('shows checkout on the public form when enabled with a whole-cent price', () => {
    assert.equal(
      paidTicketsCheckoutEnabled({ paidTicketsEnabled: true, ticketPriceCents: 100, testMode: false }),
      true,
    );
  });

  it('treats a fractional 0.9 as no price on the public form but still shows manage-entry checkout', () => {
    const args = { paidTicketsEnabled: true, ticketPriceCents: 0.9, testMode: false };
    assert.equal(paidTicketsCheckoutEnabled(args), false);
    assert.equal(paidTicketsManageEnabled(args), true);
  });
});

describe('previewEntryTickets', () => {
  it('adds newsletter tickets only when the bonus is offered and opted in', () => {
    assert.equal(
      previewEntryTickets({
        baseOnly: 2,
        newsletterEnabled: true,
        newsletterBonus: 3,
        newsletterOptIn: true,
      }),
      5,
    );
    assert.equal(
      previewEntryTickets({
        baseOnly: 2,
        newsletterEnabled: true,
        newsletterBonus: 3,
        newsletterOptIn: false,
      }),
      2,
    );
  });

  it('does not add a zero or disabled newsletter bonus', () => {
    assert.equal(newsletterShowsBonus(true, 0), false);
    assert.equal(newsletterShowsBonus(false, 3), false);
    assert.equal(
      previewEntryTickets({
        baseOnly: 2,
        newsletterEnabled: false,
        newsletterBonus: 3,
        newsletterOptIn: true,
      }),
      2,
    );
  });
});
