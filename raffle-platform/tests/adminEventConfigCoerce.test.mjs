import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  coerceAdminEventFields,
  isAdminRaffleActive,
  normalizeAdminRaffleRow,
  ensureAdminRaffleRows,
  serializeAdminRafflesForSave,
} from '../src/lib/adminEventConfigCoerce.js';

describe('coerceAdminEventFields', () => {
  it('applies paid-ticket clamps and currency truncation', () => {
    const out = coerceAdminEventFields({
      ticketPriceCents: '599.9',
      ticketCurrency: 'USD-LONG',
      paidTicketsMaxPerPurchase: '3',
      baseTicketsPerEntry: '4.8',
      newsletterBonusTickets: '2.2',
      theme: 'light',
      newsletterBonusEnabled: false,
    });
    assert.equal(out.ticketPriceCents, 599);
    assert.equal(out.ticketCurrency, 'usd-long');
    assert.equal(out.paidTicketsMaxPerPurchase, 3);
    assert.equal(out.baseTicketsPerEntry, 4);
    assert.equal(out.newsletterBonusTickets, 2);
    assert.equal(out.theme, 'light');
    assert.equal(out.newsletterBonusEnabled, false);
  });

  it('treats falsy max-per-purchase / base tickets as defaults (0 → 100 / 2)', () => {
    const zero = coerceAdminEventFields({
      paidTicketsMaxPerPurchase: 0,
      baseTicketsPerEntry: 0,
      ticketPriceCents: 0,
      newsletterBonusTickets: 0,
    });
    assert.equal(zero.paidTicketsMaxPerPurchase, 100);
    assert.equal(zero.baseTicketsPerEntry, 2);
    assert.equal(zero.ticketPriceCents, 0);
    assert.equal(zero.newsletterBonusTickets, 0);

    const empty = coerceAdminEventFields({
      paidTicketsMaxPerPurchase: '',
      baseTicketsPerEntry: null,
      ticketPriceCents: 'nope',
    });
    assert.equal(empty.paidTicketsMaxPerPurchase, 100);
    assert.equal(empty.baseTicketsPerEntry, 2);
    assert.equal(empty.ticketPriceCents, 0);
  });

  it('floors negatives to the clamp floor and defaults unknown theme to dark', () => {
    const out = coerceAdminEventFields({
      ticketPriceCents: -50,
      paidTicketsMaxPerPurchase: -3,
      baseTicketsPerEntry: -1,
      newsletterBonusTickets: -4,
      theme: 'neon',
      newsletterBonusEnabled: undefined,
    });
    assert.equal(out.ticketPriceCents, 0);
    assert.equal(out.paidTicketsMaxPerPurchase, 1);
    assert.equal(out.baseTicketsPerEntry, 1);
    assert.equal(out.newsletterBonusTickets, 0);
    assert.equal(out.theme, 'dark');
    assert.equal(out.newsletterBonusEnabled, true);
  });

  it('hydrates missing event as empty strings / unpaid defaults', () => {
    const out = coerceAdminEventFields(null);
    assert.equal(out.name, '');
    assert.equal(out.paidTicketsEnabled, false);
    assert.equal(out.ticketPriceCents, 0);
    assert.equal(out.ticketCurrency, 'usd');
    assert.equal(out.paidTicketsMaxPerPurchase, 100);
    assert.equal(out.baseTicketsPerEntry, 2);
  });
});

describe('isAdminRaffleActive / normalizeAdminRaffleRow', () => {
  it('treats false and sheet "FALSE" as inactive; everything else as active', () => {
    assert.equal(isAdminRaffleActive(false), false);
    assert.equal(isAdminRaffleActive('FALSE'), false);
    assert.equal(isAdminRaffleActive('false'), false);
    assert.equal(isAdminRaffleActive(true), true);
    assert.equal(isAdminRaffleActive('TRUE'), true);
    assert.equal(isAdminRaffleActive(undefined), true);
    assert.equal(isAdminRaffleActive(0), true);
  });

  it('prefers raffleId, falls back to id, then new-prize; trims image/value/drawAt', () => {
    const row = normalizeAdminRaffleRow(
      {
        raffleId: '  mega  ',
        id: 'ignored',
        title: 'TV',
        imageUrl: '  https://img  ',
        valueLabel: 'x'.repeat(200),
        sortOrder: '3',
        drawAt: `  ${'d'.repeat(60)}  `,
        active: 'FALSE',
      },
      () => 'key-1',
    );
    assert.equal(row.id, 'mega');
    assert.equal(row.raffleId, 'mega');
    assert.equal(row.imageUrl, 'https://img');
    assert.equal(row.valueLabel.length, 160);
    assert.equal(row.sortOrder, 3);
    assert.equal(row.drawAt.length, 50);
    assert.equal(row.active, false);
    assert.equal(row._clientListKey, 'key-1');
  });

  it('keeps an existing _clientListKey; whitespace raffleId does not fall back to id on hydrate', () => {
    const row = normalizeAdminRaffleRow(
      { id: 'pool-a', raffleId: '   ', _clientListKey: 'keep-me', sortOrder: 'nope' },
      () => 'fresh',
    );
    // raffleId '   ' is truthy, so id is ignored; trim then defaults to new-prize
    assert.equal(row.id, 'new-prize');
    assert.equal(row.raffleId, 'new-prize');
    assert.equal(row._clientListKey, 'keep-me');
    assert.equal(row.sortOrder, 0);
  });
});

describe('ensureAdminRaffleRows / serializeAdminRafflesForSave', () => {
  it('inserts a grand-prize row when the list is empty or not an array', () => {
    const rows = ensureAdminRaffleRows([], () => 'k');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].raffleId, 'grand-prize');
    assert.equal(rows[0].title, 'Grand prize');
    assert.equal(rows[0].sortOrder, 1);
    assert.deepEqual(ensureAdminRaffleRows(null, () => 'k')[0].raffleId, 'grand-prize');
  });

  it('keeps a non-empty list unchanged', () => {
    const existing = [{ raffleId: 'a' }];
    assert.equal(ensureAdminRaffleRows(existing), existing);
  });

  it('falls back sortOrder 0 to 1-based index and prefers raffleId over id', () => {
    const saved = serializeAdminRafflesForSave([
      {
        raffleId: '  a  ',
        id: 'z',
        title: '  TV  ',
        subtitle: 'sub',
        imageUrl: '  https://x  ',
        valueLabel: 'y'.repeat(200),
        sortOrder: 0,
        active: true,
        drawAt: `  ${'t'.repeat(60)}  `,
      },
      {
        raffleId: '',
        id: 'b',
        title: 'Second',
        imageUrl: '',
        valueLabel: '',
        sortOrder: 9,
        active: false,
        drawAt: '',
      },
    ]);
    assert.equal(saved[0].raffleId, 'a');
    assert.equal(saved[0].title, 'TV');
    assert.equal(saved[0].subtitle, 'sub');
    assert.equal(saved[0].imageUrl, 'https://x');
    assert.equal(saved[0].valueLabel.length, 160);
    assert.equal(saved[0].sortOrder, 1);
    assert.equal(saved[0].drawAt.length, 50);
    assert.equal(saved[1].raffleId, 'b');
    assert.equal(saved[1].sortOrder, 9);
    assert.equal(saved[1].active, false);
  });

  it('on save, whitespace raffleId falls back to id (unlike hydrate)', () => {
    const saved = serializeAdminRafflesForSave([
      { raffleId: '   ', id: 'pool-a', title: 'A', imageUrl: '', valueLabel: '', sortOrder: 2, active: true, drawAt: '' },
    ]);
    assert.equal(saved[0].raffleId, 'pool-a');
  });
});
