import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Runs POST /api/admin/[slug]/refund from route.ts. The handler decides whether
 * a paid Stripe checkout is refunded and whether Apps Script is told to zero
 * those tickets. The route imports Next and Stripe, so the test executes the
 * handler in place with stubs and does not edit or import the route.
 */
const routePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/app/api/admin/[slug]/refund/route.ts',
);

function endOfFunction(text, openBrace) {
  let depth = 0;
  let state = 'code';
  const templateDepths = [];
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
    if (state === 'tmpl') {
      if (c === '\\') {
        i += 1;
        continue;
      }
      if (c === '`') {
        state = 'code';
        continue;
      }
      if (c === '$' && next === '{') {
        templateDepths.push(depth);
        state = 'code';
        depth += 1;
        i += 1;
        continue;
      }
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
    if (c === '`') {
      state = 'tmpl';
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (templateDepths.length > 0 && depth === templateDepths[templateDepths.length - 1]) {
        templateDepths.pop();
        state = 'tmpl';
        continue;
      }
      if (depth === 0) return i;
    }
  }
  throw new Error('unterminated function body');
}

function matchingParen(text, openParen) {
  let depth = 0;
  for (let i = openParen; i < text.length; i++) {
    const c = text[i];
    if (c === '(') depth += 1;
    else if (c === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error('unterminated parameter list');
}

function slicePostBody(source) {
  const signature = 'export async function POST(';
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, 'refund route is missing POST');
  assert.equal(source.indexOf(signature, start + signature.length), -1, 'refund route defines POST twice');
  const closeParen = matchingParen(source, start + signature.length - 1);
  const open = source.indexOf('{', closeParen);
  assert.notEqual(open, -1, 'refund route POST is missing a body');
  const end = endOfFunction(source, open);
  const body = source
    .slice(open + 1, end)
    .replace('let body: Body;', 'let body;')
    .replace('(await request.json()) as Body', '(await request.json())')
    .replace('let session: Stripe.Checkout.Session;', 'let session;')
    .replace('let refund: Stripe.Refund | null = null;', 'let refund = null;')
    .replace(
      'const stripeErr = e as { code?: string; type?: string; statusCode?: number; message?: string };',
      'const stripeErr = e;',
    )
    .replace('let sheetData: unknown;', 'let sheetData;');
  assert.equal(body.includes(' as '), false);
  assert.equal(body.includes(': Body'), false);
  assert.equal(body.includes(': unknown'), false);
  assert.equal(body.includes('Stripe.Checkout.Session'), false);
  assert.equal(body.includes('Stripe.Refund'), false);
  assert.match(body, /charge_already_refunded/);
  assert.match(body, /password_mismatch/);
  assert.match(body, /refundPaidPurchase/);
  assert.match(body, /no_payment_intent/);
  return body;
}

const NextResponse = {
  json(body, init) {
    return { body, status: init && init.status ? init.status : 200 };
  },
};

const post = new Function(
  'NextResponse',
  'getAppsScriptUrl',
  'getStripeClient',
  'fetchAppsScriptPost',
  "'use strict';\nreturn async function post(request, context) {\n" +
    slicePostBody(fs.readFileSync(routePath, 'utf8')) +
    '\n};',
);

function requestFor({ headerKey, json, jsonError }) {
  return {
    headers: {
      get(name) {
        if (name === 'x-admin-key') return headerKey === undefined ? null : headerKey;
        return null;
      },
    },
    async json() {
      if (jsonError) throw jsonError;
      return json;
    },
  };
}

function contextFor(slug) {
  return { params: Promise.resolve({ slug }) };
}

function stripeClientFor(state) {
  return {
    checkout: {
      sessions: {
        async retrieve(id) {
          state.retrieved.push(id);
          if (state.retrieveError) throw state.retrieveError;
          return state.session;
        },
      },
    },
    refunds: {
      async create(args) {
        state.refundCreates.push(args);
        if (state.createError) throw state.createError;
        return state.createResult;
      },
    },
  };
}

async function run(options) {
  const state = {
    appsScriptUrl: 'https://script.example/exec',
    stripeThrows: false,
    stripeCalls: 0,
    retrieved: [],
    refundCreates: [],
    sheetCalls: [],
    retrieveError: null,
    createError: null,
    createResult: { id: 're_123', status: 'succeeded' },
    session: {
      id: 'cs_abc',
      payment_status: 'paid',
      payment_intent: 'pi_123',
      metadata: { raffle_slug: options.slug || 'spring' },
    },
    sheetResult: {
      ok: true,
      async text() {
        return JSON.stringify({ ok: true, rowsChanged: 2, ticketsRefunded: 6 });
      },
    },
    ...options.state,
  };
  const result = await post(
    NextResponse,
    () => state.appsScriptUrl,
    () => {
      state.stripeCalls += 1;
      if (state.stripeThrows) throw new Error('STRIPE_SECRET_KEY missing');
      return stripeClientFor(state);
    },
    async (base, payload) => {
      state.sheetCalls.push({ base, payload });
      if (state.sheetError) throw state.sheetError;
      return state.sheetResult;
    },
  )(
    requestFor({
      headerKey: options.headerKey,
      json: options.json,
      jsonError: options.jsonError,
    }),
    contextFor(options.slug || 'spring'),
  );
  return { result, state };
}

const authorized = {
  stripeSessionId: 'cs_abc',
  adminPassword: 'secret',
};

describe('raffle refund route', { concurrency: 1 }, () => {
  it('rejects a body that is not JSON before looking at Stripe', async () => {
    const { result, state } = await run({
      headerKey: 'secret',
      jsonError: new SyntaxError('Unexpected token'),
    });
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { ok: false, error: 'invalid_json' });
    assert.equal(state.stripeCalls, 0);
    assert.equal(state.sheetCalls.length, 0);
  });

  it('rejects a missing checkout session before asking for the password', async () => {
    for (const stripeSessionId of [undefined, '', '   ']) {
      const { result, state } = await run({
        headerKey: 'secret',
        json: { stripeSessionId, adminPassword: '' },
        state: { appsScriptUrl: '' },
      });
      assert.equal(result.status, 400);
      assert.deepEqual(result.body, { ok: false, error: 'missing_session' });
      assert.equal(state.stripeCalls, 0);
    }
  });

  it('requires the confirm password and rejects a password that differs from the admin header', async () => {
    for (const adminPassword of [undefined, '', '   ']) {
      const { result, state } = await run({
        headerKey: 'secret',
        json: { stripeSessionId: 'cs_abc', adminPassword },
        state: { appsScriptUrl: '' },
      });
      assert.equal(result.status, 401);
      assert.deepEqual(result.body, { ok: false, error: 'password_required' });
      assert.equal(state.stripeCalls, 0);
    }

    const mismatch = await run({
      headerKey: 'secret',
      json: { stripeSessionId: 'cs_abc', adminPassword: 'other' },
      state: { appsScriptUrl: '' },
    });
    assert.equal(mismatch.result.status, 401);
    assert.deepEqual(mismatch.result.body, { ok: false, error: 'password_mismatch' });
    assert.equal(mismatch.state.stripeCalls, 0);
    assert.equal(mismatch.state.sheetCalls.length, 0);
  });

  it('stops when Apps Script or Stripe is not configured', async () => {
    const noSheet = await run({
      headerKey: 'secret',
      json: authorized,
      state: { appsScriptUrl: '' },
    });
    assert.equal(noSheet.result.status, 503);
    assert.deepEqual(noSheet.result.body, { ok: false, error: 'server_misconfigured' });
    assert.equal(noSheet.state.stripeCalls, 0);

    const noStripe = await run({
      headerKey: 'secret',
      json: authorized,
      state: { stripeThrows: true },
    });
    assert.equal(noStripe.result.status, 503);
    assert.deepEqual(noStripe.result.body, { ok: false, error: 'stripe_not_configured' });
    assert.equal(noStripe.state.sheetCalls.length, 0);
  });

  it('returns the Stripe lookup failure and does not create a refund', async () => {
    const failed = await run({
      headerKey: 'secret',
      json: authorized,
      state: { retrieveError: new Error('No such checkout.session: cs_abc') },
    });
    assert.equal(failed.result.status, 502);
    assert.deepEqual(failed.result.body, { ok: false, error: 'No such checkout.session: cs_abc' });
    assert.deepEqual(failed.state.refundCreates, []);

    const unknown = await run({
      headerKey: 'secret',
      json: authorized,
      state: { retrieveError: 'down' },
    });
    assert.equal(unknown.result.status, 502);
    assert.deepEqual(unknown.result.body, { ok: false, error: 'stripe_lookup_failed' });
  });

  it('does not refund a checkout Stripe does not consider paid', async () => {
    for (const paymentStatus of ['unpaid', 'no_payment_required', undefined]) {
      const { result, state } = await run({
        headerKey: 'secret',
        json: authorized,
        state: {
          session: {
            payment_status: paymentStatus,
            payment_intent: 'pi_123',
            metadata: { raffle_slug: 'spring' },
          },
        },
      });
      assert.equal(result.status, 409);
      assert.deepEqual(result.body, { ok: false, error: 'not_paid', paymentStatus });
      assert.deepEqual(state.refundCreates, []);
      assert.equal(state.sheetCalls.length, 0);
    }
  });

  it('does not invent a payment intent when Stripe did not return one', async () => {
    for (const paymentIntent of [undefined, null, '', {}, { id: '' }]) {
      const { result, state } = await run({
        headerKey: 'secret',
        json: authorized,
        state: {
          session: {
            payment_status: 'paid',
            payment_intent: paymentIntent,
            metadata: { raffle_slug: 'spring' },
          },
        },
      });
      assert.equal(result.status, 502);
      assert.deepEqual(result.body, { ok: false, error: 'no_payment_intent' });
      assert.deepEqual(state.refundCreates, []);
      assert.equal(state.sheetCalls.length, 0);
    }
  });

  it('refunds the session payment intent and asks Apps Script to zero those tickets', async () => {
    for (const paymentIntent of ['pi_123', { id: 'pi_123' }]) {
      const { result, state } = await run({
        headerKey: 'secret',
        json: { stripeSessionId: '  cs_abc  ', adminPassword: 'secret' },
        state: {
          session: {
            payment_status: 'paid',
            payment_intent: paymentIntent,
            metadata: { raffle_slug: 'spring' },
          },
        },
      });
      assert.equal(result.status, 200);
      assert.deepEqual(state.retrieved, ['cs_abc']);
      assert.deepEqual(state.refundCreates, [
        {
          payment_intent: 'pi_123',
          reason: 'requested_by_customer',
          metadata: {
            raffle_slug: 'spring',
            raffle_session: 'cs_abc',
            source: 'admin_panel',
          },
        },
      ]);
      assert.deepEqual(state.sheetCalls, [
        {
          base: 'https://script.example/exec',
          payload: {
            action: 'refundPaidPurchase',
            slug: 'spring',
            adminKey: 'secret',
            stripeSessionId: 'cs_abc',
            refundId: 're_123',
            actor: 'admin_panel',
          },
        },
      ]);
      assert.deepEqual(result.body, {
        ok: true,
        refundId: 're_123',
        stripeStatus: 'succeeded',
        alreadyRefundedOnStripe: false,
        sheet: { ok: true, rowsChanged: 2, ticketsRefunded: 6 },
      });
    }
  });

  it('still updates the sheet when Stripe says the charge was already refunded', async () => {
    const { result, state } = await run({
      headerKey: 'secret',
      json: authorized,
      state: {
        createError: {
          code: 'charge_already_refunded',
          type: 'StripePermissionError',
          statusCode: 403,
          message: 'Charge already refunded',
        },
      },
    });
    assert.equal(result.status, 200);
    assert.equal(state.refundCreates.length, 1);
    assert.deepEqual(state.sheetCalls[0].payload.refundId, '');
    assert.equal(state.sheetCalls[0].payload.stripeSessionId, 'cs_abc');
    assert.deepEqual(result.body, {
      ok: true,
      refundId: null,
      stripeStatus: 'already_refunded',
      alreadyRefundedOnStripe: true,
      sheet: { ok: true, rowsChanged: 2, ticketsRefunded: 6 },
    });
  });

  it('reports a missing refund permission and does not touch the sheet', async () => {
    const permissionMessage =
      "stripe_missing_refund_permission: the API key in STRIPE_SECRET_KEY does not have 'Refunds: Write'. Roll a new restricted key with that permission and replace STRIPE_SECRET_KEY.";
    for (const createError of [
      { type: 'StripePermissionError', message: 'permission denied' },
      { statusCode: 403, code: 'secret_key_required', message: 'forbidden' },
    ]) {
      const { result, state } = await run({
        headerKey: 'secret',
        json: authorized,
        state: { createError },
      });
      assert.equal(result.status, 403);
      assert.deepEqual(result.body, { ok: false, error: permissionMessage });
      assert.equal(state.sheetCalls.length, 0);
    }
  });

  it('returns other Stripe refund failures without updating the sheet', async () => {
    const disputed = await run({
      headerKey: 'secret',
      json: authorized,
      state: { createError: { code: 'charge_disputed', message: 'This charge is disputed' } },
    });
    assert.equal(disputed.result.status, 502);
    assert.deepEqual(disputed.result.body, {
      ok: false,
      error: 'This charge is disputed',
      stripeCode: 'charge_disputed',
    });
    assert.equal(disputed.state.sheetCalls.length, 0);

    const blank = await run({
      headerKey: 'secret',
      json: authorized,
      state: { createError: { statusCode: 500 } },
    });
    assert.equal(blank.result.status, 502);
    assert.deepEqual(blank.result.body, { ok: false, error: 'refund_failed', stripeCode: null });
    assert.equal(blank.state.sheetCalls.length, 0);
  });

  it('keeps the Stripe refund id when the sheet update fails afterward', async () => {
    const badJson = await run({
      headerKey: 'secret',
      json: authorized,
      state: {
        sheetResult: {
          ok: true,
          async text() {
            return 'not-json';
          },
        },
      },
    });
    assert.equal(badJson.result.status, 502);
    assert.deepEqual(badJson.result.body, {
      ok: false,
      error:
        'refund_done_but_sheet_failed: Stripe refund succeeded but Apps Script returned invalid JSON; sheet not updated.',
      refundId: 're_123',
    });

    const upstream = await run({
      headerKey: 'secret',
      json: authorized,
      state: {
        sheetResult: {
          ok: false,
          async text() {
            return JSON.stringify({ ok: false, error: 'unauthorized' });
          },
        },
      },
    });
    assert.equal(upstream.result.status, 502);
    assert.deepEqual(upstream.result.body, {
      ok: false,
      error: 'refund_done_but_sheet_failed',
      upstream: { ok: false, error: 'unauthorized' },
      refundId: 're_123',
    });

    const unreachable = await run({
      headerKey: 'secret',
      json: authorized,
      state: { sheetError: new Error('socket hang up') },
    });
    assert.equal(unreachable.result.status, 502);
    assert.deepEqual(unreachable.result.body, {
      ok: false,
      error: 'refund_done_but_sheet_failed: socket hang up',
      refundId: 're_123',
    });

    const unknown = await run({
      headerKey: 'secret',
      json: authorized,
      state: { sheetError: 'offline' },
    });
    assert.equal(unknown.result.status, 502);
    assert.deepEqual(unknown.result.body, {
      ok: false,
      error: 'refund_done_but_sheet_failed: apps_script_unreachable',
      refundId: 're_123',
    });
  });
});
