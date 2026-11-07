import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

// stripePayments.js opens the database and constructs the Stripe SDK.
// Execute only the secret-key gate and the webhook signature check.
const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../services/payments/stripePayments.js'),
  'utf8'
);

function sliceFunction(signature) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`stripePayments slice marker moved: ${signature}`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated stripePayments function: ${signature}`);
}

const calls = [];
let constructEventImpl = () => ({ id: 'evt_unused' });

class FakeStripe {
  constructor(key, options) {
    this.key = key;
    this.options = options;
    this.webhooks = {
      constructEvent(rawBody, signature, secret) {
        calls.push({ rawBody, signature, secret, key, options });
        return constructEventImpl(rawBody, signature, secret);
      },
    };
  }
}

const verifyStripeWebhookEvent = new Function(
  'Stripe',
  `${sliceFunction('function getStripe() {')}
${sliceFunction('export function verifyStripeWebhookEvent(rawBody, signature) {').replace(
  /^export /,
  ''
)}
return verifyStripeWebhookEvent;`
)(FakeStripe);

const originalEnv = {
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_PAYMENTS_WEBHOOK_SECRET: process.env.STRIPE_PAYMENTS_WEBHOOK_SECRET,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function setEnv(key, value) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

describe('stripePayments webhook signature gate', { concurrency: false }, () => {
  beforeEach(() => {
    calls.length = 0;
    constructEventImpl = () => ({ id: 'evt_unused' });
    setEnv('STRIPE_SECRET_KEY', 'sk_test_webhook_coverage');
    setEnv('STRIPE_PAYMENTS_WEBHOOK_SECRET', undefined);
    setEnv('STRIPE_WEBHOOK_SECRET', undefined);
  });

  afterEach(() => {
    restoreEnv();
  });

  it('returns null and does not verify when Stripe or the webhook secret is missing', () => {
    setEnv('STRIPE_SECRET_KEY', undefined);
    setEnv('STRIPE_PAYMENTS_WEBHOOK_SECRET', 'whsec_payments');
    assert.equal(verifyStripeWebhookEvent(Buffer.from('{}'), 't=1,v1=abc'), null);

    setEnv('STRIPE_SECRET_KEY', 'pk_test_webhook_coverage');
    assert.equal(verifyStripeWebhookEvent(Buffer.from('{}'), 't=1,v1=abc'), null);

    setEnv('STRIPE_SECRET_KEY', 'sk_test_webhook_coverage');
    setEnv('STRIPE_PAYMENTS_WEBHOOK_SECRET', undefined);
    setEnv('STRIPE_WEBHOOK_SECRET', undefined);
    assert.equal(verifyStripeWebhookEvent(Buffer.from('{}'), 't=1,v1=abc'), null);

    setEnv('STRIPE_PAYMENTS_WEBHOOK_SECRET', '   ');
    setEnv('STRIPE_WEBHOOK_SECRET', '   ');
    assert.equal(verifyStripeWebhookEvent(Buffer.from('{}'), 't=1,v1=abc'), null);

    assert.equal(calls.length, 0);
  });

  it('prefers the payments webhook secret and falls back to the legacy secret', () => {
    const rawBody = Buffer.from('{"id":"evt_1"}');
    const signature = 't=1710000000,v1=signature';
    const event = { id: 'evt_1', type: 'payment_intent.succeeded' };
    constructEventImpl = () => event;

    setEnv('STRIPE_PAYMENTS_WEBHOOK_SECRET', '  whsec_payments  ');
    setEnv('STRIPE_WEBHOOK_SECRET', 'whsec_legacy');
    assert.equal(verifyStripeWebhookEvent(rawBody, signature), event);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].rawBody, rawBody);
    assert.equal(calls[0].signature, signature);
    assert.equal(calls[0].secret, 'whsec_payments');
    assert.equal(calls[0].key, 'sk_test_webhook_coverage');
    assert.deepEqual(calls[0].options, { apiVersion: '2024-06-20' });

    calls.length = 0;
    setEnv('STRIPE_PAYMENTS_WEBHOOK_SECRET', '');
    setEnv('STRIPE_WEBHOOK_SECRET', '  whsec_legacy  ');
    assert.equal(verifyStripeWebhookEvent(rawBody, undefined), event);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].signature, undefined);
    assert.equal(calls[0].secret, 'whsec_legacy');

    calls.length = 0;
    setEnv('STRIPE_PAYMENTS_WEBHOOK_SECRET', undefined);
    setEnv('STRIPE_WEBHOOK_SECRET', 'whsec_legacy');
    assert.equal(verifyStripeWebhookEvent('{"id":"evt_1"}', signature), event);
    assert.equal(calls[0].rawBody, '{"id":"evt_1"}');
    assert.equal(calls[0].secret, 'whsec_legacy');
  });

  it('turns a rejected signature into null and returns a verified event', () => {
    const rawBody = Buffer.from('{"id":"evt_bad"}');
    constructEventImpl = () => {
      throw new Error('No signatures found matching the expected signature for payload');
    };
    setEnv('STRIPE_WEBHOOK_SECRET', 'whsec_legacy');
    assert.equal(verifyStripeWebhookEvent(rawBody, 't=1,v1=bad'), null);
    assert.equal(calls.length, 1);

    constructEventImpl = () => {
      throw 'signature mismatch';
    };
    assert.equal(verifyStripeWebhookEvent(rawBody, ''), null);

    const event = { id: 'evt_ok', type: 'setup_intent.succeeded', livemode: false };
    constructEventImpl = () => event;
    assert.equal(verifyStripeWebhookEvent(rawBody, 't=1,v1=good'), event);
    assert.equal(calls.length, 3);
    assert.equal(calls[2].signature, 't=1,v1=good');
    assert.equal(calls[2].secret, 'whsec_legacy');
  });
});
