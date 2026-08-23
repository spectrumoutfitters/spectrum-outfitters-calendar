import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCheckoutRequest,
  ticketPriceCents,
  ticketCurrency,
  paidTicketsMaxPerPurchase,
  sanitizePaidTicketSplit,
  evaluatePaidTicketPurchase,
} from '../src/lib/paidCheckoutSplit.js';

const event = {
  paidTicketsEnabled: true,
  ticketPriceCents: 500,
  ticketCurrency: 'USD',
  paidTicketsMaxPerPurchase: 10,
  raffles: [{ id: 'grand' }, { id: 'daily' }],
};

describe('parseCheckoutRequest', () => {
  it('requires slug, token, and a ticketSplit object', () => {
    assert.deepEqual(parseCheckoutRequest({}), { ok: false, error: 'missing_fields' });
    assert.deepEqual(parseCheckoutRequest({ slug: 'go', token: 't' }), {
      ok: false,
      error: 'missing_fields',
    });
    assert.deepEqual(parseCheckoutRequest({ slug: 'go', token: 't', ticketSplit: 'nope' }), {
      ok: false,
      error: 'missing_fields',
    });
    assert.equal(parseCheckoutRequest({ slug: '  ', token: 't', ticketSplit: { a: 1 } }).ok, false);
  });

  it('trims slug/token; arrays count as objects (current typeof check)', () => {
    const parsed = parseCheckoutRequest({ slug: ' go ', token: ' tok ', ticketSplit: { grand: 2 } });
    assert.equal(parsed.ok, true);
    assert.equal(parsed.slug, 'go');
    assert.equal(parsed.token, 'tok');

    const fromArray = parseCheckoutRequest({ slug: 'go', token: 't', ticketSplit: [1] });
    assert.equal(fromArray.ok, true);
  });
});

describe('ticketPriceCents / currency / max', () => {
  it('floors price and maps falsy to 0', () => {
    assert.equal(ticketPriceCents({ ticketPriceCents: 499.9 }), 499);
    assert.equal(ticketPriceCents({ ticketPriceCents: 0 }), 0);
    assert.equal(ticketPriceCents({ ticketPriceCents: -5 }), 0);
    assert.equal(ticketPriceCents({}), 0);
    assert.equal(ticketPriceCents({ ticketPriceCents: '250' }), 250);
  });

  it('defaults currency to usd and lowercases', () => {
    assert.equal(ticketCurrency({}), 'usd');
    assert.equal(ticketCurrency({ ticketCurrency: 'USD' }), 'usd');
  });

  it('defaults max to 100 when 0/NaN; clamps negatives to 1', () => {
    assert.equal(paidTicketsMaxPerPurchase({}), 100);
    assert.equal(paidTicketsMaxPerPurchase({ paidTicketsMaxPerPurchase: 0 }), 100);
    assert.equal(paidTicketsMaxPerPurchase({ paidTicketsMaxPerPurchase: -3 }), 1);
    assert.equal(paidTicketsMaxPerPurchase({ paidTicketsMaxPerPurchase: 25 }), 25);
    assert.equal(paidTicketsMaxPerPurchase({ paidTicketsMaxPerPurchase: 0.9 }), 1);
  });
});

describe('sanitizePaidTicketSplit', () => {
  it('drops unknown pools, zeros, and non-numeric quantities', () => {
    const { cleanSplit, totalTickets } = sanitizePaidTicketSplit(
      { grand: 2, daily: 0, other: 9, dailyx: 1, bad: 'nope', frac: 1.9 },
      event.raffles
    );
    assert.deepEqual(cleanSplit, { grand: 2 });
    assert.equal(totalTickets, 2);
  });

  it('floors fractional known pools and ignores negatives', () => {
    const { cleanSplit, totalTickets } = sanitizePaidTicketSplit(
      { grand: 2.8, daily: -4 },
      event.raffles
    );
    assert.deepEqual(cleanSplit, { grand: 2 });
    assert.equal(totalTickets, 2);
  });
});

describe('evaluatePaidTicketPurchase', () => {
  it('rejects disabled / zero-price / empty / over-max splits', () => {
    assert.equal(evaluatePaidTicketPurchase({ ...event, paidTicketsEnabled: false }, { grand: 1 }).error, 'paid_tickets_disabled');
    assert.equal(evaluatePaidTicketPurchase({ ...event, ticketPriceCents: 0 }, { grand: 1 }).error, 'ticket_price_not_set');
    assert.equal(evaluatePaidTicketPurchase(event, { nope: 5 }).error, 'must_buy_at_least_one');
    const over = evaluatePaidTicketPurchase(event, { grand: 6, daily: 6 });
    assert.equal(over.error, 'max_10_per_purchase');
    assert.equal(over.maxPerPurchase, 10);
  });

  it('returns cleaned split, total, price, and currency on success', () => {
    const ok = evaluatePaidTicketPurchase(event, { grand: 3, daily: 2, extra: 99 });
    assert.equal(ok.ok, true);
    assert.deepEqual(ok.cleanSplit, { grand: 3, daily: 2 });
    assert.equal(ok.totalTickets, 5);
    assert.equal(ok.priceCents, 500);
    assert.equal(ok.currency, 'usd');
  });
});
