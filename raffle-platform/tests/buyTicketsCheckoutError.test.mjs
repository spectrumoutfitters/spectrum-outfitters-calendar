import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Executes formatCheckoutError from BuyTicketsCard. The card is the paid
 * "buy more tickets" checkout on the entry page and the manage-entry page.
 * EventEntryClient has a separate copy of this helper; these cases are the
 * card's own wording, including draw-lock and unconfigured Stripe.
 * The component is not imported (it pulls React) and the file is not edited.
 */
const cardPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/components/raffle/BuyTicketsCard.tsx',
);
const source = fs.readFileSync(cardPath, 'utf8');

function endOfFunction(text, openBrace) {
  let depth = 0;
  let state = 'code';
  for (let i = openBrace; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (state === 'line') {
      if (c === '\n') state = 'code';
      continue;
    }
    if (state === 'block') {
      if (c === '*' && next === '/') {
        state = 'code';
        i += 1;
      }
      continue;
    }
    if (state === 'sq' || state === 'dq') {
      if (c === '\\') {
        i += 1;
        continue;
      }
      if ((state === 'sq' && c === "'") || (state === 'dq' && c === '"')) state = 'code';
      continue;
    }
    if (c === '/' && next === '/') {
      state = 'line';
      i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      state = 'block';
      i += 1;
      continue;
    }
    if (c === "'") {
      state = 'sq';
      continue;
    }
    if (c === '"') {
      state = 'dq';
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error('unterminated function body');
}

function loadCheckoutError() {
  const marker = 'function formatCheckoutError(';
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, 'BuyTicketsCard.tsx is missing formatCheckoutError');
  assert.equal(
    source.indexOf(marker, start + marker.length),
    -1,
    'BuyTicketsCard.tsx defines formatCheckoutError twice',
  );
  const open = source.indexOf('{', start);
  const end = endOfFunction(source, open);
  const signature = source.slice(start, open);
  const body = source.slice(open, end + 1);
  assert.match(signature, /code:\s*string\s*\|\s*undefined/);
  assert.match(signature, /:\s*string\s*$/);
  assert.match(body, /to make changes/);
  const fn = signature
    .replace(/\(code:\s*string\s*\|\s*undefined\)/, '(code)')
    .replace(/:\s*string\s*$/, '');
  return new Function(`${fn}${body}\nreturn formatCheckoutError;`)();
}

const formatCheckoutError = loadCheckoutError();

describe('BuyTicketsCard formatCheckoutError', () => {
  it('explains disabled sales, missing price, an empty cart, a locked draw, and Stripe setup', () => {
    assert.equal(
      formatCheckoutError('paid_tickets_disabled'),
      "Paid tickets aren't enabled for this event yet.",
    );
    assert.equal(
      formatCheckoutError('ticket_price_not_set'),
      'Ticket pricing isn\'t configured yet — check back soon.',
    );
    assert.equal(
      formatCheckoutError('must_buy_at_least_one'),
      'Pick at least one ticket before checking out.',
    );
    assert.equal(
      formatCheckoutError('entry_locked'),
      'This entry is locked because a draw is too close to make changes.',
    );
    assert.equal(
      formatCheckoutError('stripe_not_configured'),
      'Online payments are temporarily unavailable.',
    );
    assert.equal(
      formatCheckoutError('missing_fields'),
      'Something is missing from the request — refresh and try again.',
    );
  });

  it('turns a max_ cap code into words and keeps unknown failures on the retry message', () => {
    assert.equal(formatCheckoutError('max_10'), 'max 10');
    assert.equal(formatCheckoutError('max_4_per_pool'), 'max 4 per pool');

    assert.equal(formatCheckoutError(undefined), 'Could not start checkout. Try again in a moment.');
    assert.equal(formatCheckoutError(null), 'Could not start checkout. Try again in a moment.');
    assert.equal(formatCheckoutError(''), 'Could not start checkout. Try again in a moment.');
    assert.equal(formatCheckoutError('stripe_error'), 'Could not start checkout. Try again in a moment.');
    assert.equal(formatCheckoutError('max'), 'Could not start checkout. Try again in a moment.');
  });
});
