import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Runs the Stripe webhook's session gate from route.ts. This is the step that
 * decides whether a checkout becomes paid raffle tickets. The route imports
 * Next and Stripe and posts to Apps Script, so the test executes the decision
 * in place and stops before the signature and the network call.
 */
const routePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/app/api/raffle/webhook/route.ts',
);
const source = fs.readFileSync(routePath, 'utf8');

const START = 'if (event.type !== "checkout.session.completed"';
const END = 'const payloadString = JSON.stringify(payload);';

function sliceDecision() {
  const start = source.indexOf(START);
  assert.notEqual(start, -1, 'webhook route is missing the checkout session gate');
  assert.equal(source.indexOf(START, start + START.length), -1, 'webhook route defines the session gate twice');
  const end = source.indexOf(END, start);
  assert.notEqual(end, -1, 'webhook route is missing the payload stringify');
  assert.equal(source.indexOf(END, end + END.length), -1, 'webhook route stringifies the payload twice');
  const slice = source.slice(start, end + END.length);
  assert.match(slice, /as Stripe\.Checkout\.Session/);
  assert.match(slice, /let ticketSplit: Record<string, number> = \{\}/);
  assert.match(slice, /as Record<string, unknown>/);
  assert.match(slice, /\bas number\b/);
  assert.match(slice, /checkout\.session\.async_payment_succeeded/);
  assert.match(slice, /invalid_session_metadata/);
  const runnable = slice
    .replace(' as Stripe.Checkout.Session', '')
    .replace(': Record<string, number>', '')
    .replace(' as Record<string, unknown>', '')
    .replace(' as number', '');
  assert.equal(runnable.includes(' as '), false);
  return runnable;
}

const NextResponse = {
  json(body, init) {
    return { body, status: init && init.status ? init.status : 200 };
  },
};

let appsScriptUrl = 'https://script.example/exec';

const decide = new Function(
  'NextResponse',
  'getAppsScriptUrl',
  "'use strict';\nfunction decide(event) {\n"
    + sliceDecision()
    + '\nreturn { body: { ok: true, payload, payloadString }, status: 200 };\n}\nreturn decide;',
)(NextResponse, () => appsScriptUrl);

function paidEvent(type, metadata, extra = {}) {
  return {
    type,
    data: {
      object: {
        id: 'cs_test_123',
        payment_status: 'paid',
        status: 'complete',
        created: 1700000000,
        amount_total: 2500,
        currency: 'usd',
        ...extra,
        metadata,
      },
    },
  };
}

describe('paid webhook session gate', () => {
  it('ignores events that are not a completed checkout', () => {
    for (const type of [
      'payment_intent.succeeded',
      'checkout.session.expired',
      'checkout.session.async_payment_failed',
      'charge.refunded',
    ]) {
      const result = decide(paidEvent(type, {}));
      assert.equal(result.status, 200);
      assert.deepEqual(result.body, { ok: true, ignored: true, type });
    }
  });

  it('does not build a ticket payload while the checkout is still unpaid and open', () => {
    for (const session of [
      { payment_status: 'unpaid', status: 'open' },
      { payment_status: 'unpaid' },
      {},
    ]) {
      const result = decide({
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_open', ...session, metadata: { raffle_slug: 'spring' } } },
      });
      assert.equal(result.status, 200);
      assert.deepEqual(result.body, { ok: true, awaiting_payment: true });
    }
  });

  it('rejects a paid checkout whose slug, token, or ticket count cannot be applied', () => {
    const cases = [
      null,
      {},
      { raffle_slug: '   ', entry_token: 'tok', total_tickets: '2' },
      { raffle_slug: 'spring', entry_token: '   ', total_tickets: '2' },
      { raffle_slug: 'spring', entry_token: 'tok', total_tickets: '0' },
      { raffle_slug: 'spring', entry_token: 'tok', total_tickets: '-3' },
      { raffle_slug: 'spring', entry_token: 'tok', total_tickets: '0.9' },
      { raffle_slug: 'spring', entry_token: 'tok' },
      { raffle_slug: 'spring', entry_token: 'tok', total_tickets: 'nope' },
    ];
    for (const metadata of cases) {
      const result = decide(paidEvent('checkout.session.completed', metadata));
      assert.equal(result.status, 400);
      assert.deepEqual(result.body, { ok: false, error: 'invalid_session_metadata' });
    }
  });

  it('builds the apply payload from a paid session, including a delayed success event', () => {
    const metadata = {
      raffle_slug: '  spring  ',
      entry_token: '  tok_abc  ',
      total_tickets: '2.9',
      ticket_split: JSON.stringify({ grand: 2.9, daily: 0, night: -4, bad: 'x' }),
    };
    for (const type of ['checkout.session.completed', 'checkout.session.async_payment_succeeded']) {
      const result = decide(paidEvent(type, metadata, { status: 'open' }));
      assert.equal(result.status, 200);
      assert.equal(result.body.ok, true);
      assert.deepEqual(result.body.payload, {
        slug: 'spring',
        token: 'tok_abc',
        stripeSessionId: 'cs_test_123',
        totalPaidTickets: 2,
        ticketSplit: { grand: 2 },
        paidAt: '2023-11-14T22:13:20.000Z',
        amountTotal: 2500,
        currency: 'usd',
        clientIp: 'stripe-webhook',
        userAgent: 'stripe-webhook',
      });
      assert.equal(result.body.payloadString, JSON.stringify(result.body.payload));
    }
  });

  it('does not invent ticket quantities when the split metadata is missing or broken', () => {
    const cases = [
      { raffle_slug: 'spring', entry_token: 'tok', total_tickets: '2' },
      { raffle_slug: 'spring', entry_token: 'tok', total_tickets: '2', ticket_split: '{' },
      { raffle_slug: 'spring', entry_token: 'tok', total_tickets: '2', ticket_split: 'null' },
    ];
    for (const metadata of cases) {
      const result = decide(paidEvent('checkout.session.completed', metadata));
      assert.equal(result.status, 200, metadata.ticket_split);
      const split = result.body.payload.ticketSplit;
      const quantities = split && typeof split === 'object' ? Object.values(split) : [];
      assert.deepEqual(quantities.filter((n) => Number(n) > 0), []);
      assert.equal(result.body.payload.totalPaidTickets, 2);
      assert.equal(result.body.payload.slug, 'spring');
    }
  });

  it('keeps a numeric amount, including zero, and drops a non-numeric amount', () => {
    const base = { raffle_slug: 'spring', entry_token: 'tok', total_tickets: '1' };
    const zero = decide(paidEvent('checkout.session.completed', base, { amount_total: 0, currency: '' }));
    assert.equal(zero.body.payload.amountTotal, 0);
    assert.equal(zero.body.payload.currency, 'usd');

    const euros = decide(paidEvent('checkout.session.completed', base, { amount_total: '2500', currency: 'eur' }));
    assert.equal(euros.body.payload.amountTotal, null);
    assert.equal(euros.body.payload.currency, 'eur');

    const missing = decide(paidEvent('checkout.session.completed', base, { amount_total: undefined, currency: undefined }));
    assert.equal(missing.body.payload.amountTotal, null);
    assert.equal(missing.body.payload.currency, 'usd');
  });

  it('stops before signing when Apps Script is not configured', () => {
    appsScriptUrl = '';
    try {
      const result = decide(paidEvent('checkout.session.completed', {
        raffle_slug: 'spring',
        entry_token: 'tok',
        total_tickets: '1',
      }));
      assert.equal(result.status, 503);
      assert.deepEqual(result.body, { ok: false, error: 'apps_script_not_configured' });
    } finally {
      appsScriptUrl = 'https://script.example/exec';
    }
  });
});
