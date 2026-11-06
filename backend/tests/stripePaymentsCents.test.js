import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

// stripePayments.js opens the database and constructs the Stripe SDK.
// Execute only the secret-key gate, the cents coercion, and the payment-intent
// amount lines that call cents().
const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../services/payments/stripePayments.js'),
  'utf8'
);

const stripeStart = source.indexOf('function getStripe() {');
const centsStart = source.indexOf('\nfunction cents(n) {', stripeStart);
const centsEnd = source.indexOf(
  '\nexport async function getOrCreateStripeCustomerForCrmCustomer',
  centsStart
);
const totalStart = source.indexOf('  const total = cents(invoice.total_cents);');
const totalEnd = source.indexOf('  const paidRow = await db.getAsync(', totalStart);
const dueStart = source.indexOf('  const alreadyPaid = cents(paidRow?.paid) || 0;');
const dueEnd = source.indexOf(
  '  const { providerCustomerId, error } = await getOrCreateStripeCustomerForCrmCustomer(invoice.crm_customer_id);',
  dueStart
);
if (
  stripeStart < 0 ||
  centsStart < 0 ||
  centsEnd < 0 ||
  totalStart < 0 ||
  totalEnd < 0 ||
  dueStart < 0 ||
  dueEnd < 0
) {
  throw new Error('stripePayments cents slice markers moved');
}

class FakeStripe {
  constructor(key, options) {
    this.key = key;
    this.options = options;
  }
}

const getStripe = new Function(
  'Stripe',
  `${source.slice(stripeStart, centsStart)}\nreturn getStripe;`
)(FakeStripe);

const cents = new Function(
  `${source.slice(centsStart, centsEnd)}\nreturn cents;`
)();

const paymentIntentAmountDue = new Function(
  'cents',
  `return function paymentIntentAmountDue(invoice, paidRow) {
${source.slice(totalStart, totalEnd)}
${source.slice(dueStart, dueEnd)}
  return { amountDue };
};`
)(cents);

const originalStripeKey = process.env.STRIPE_SECRET_KEY;

afterEach(() => {
  if (originalStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = originalStripeKey;
});

describe('stripePayments cents and secret-key gate', { concurrency: false }, () => {
  it('rounds finite cent amounts and returns null for non-finite amounts', () => {
    assert.equal(cents(1999.4), 1999);
    assert.equal(cents(1999.5), 2000);
    assert.equal(cents(1999.6), 2000);
    assert.equal(cents(-10.5), -10);
    assert.equal(cents(' 150 '), 150);
    assert.equal(cents('10.5'), 11);
    assert.equal(cents(0), 0);
    assert.equal(cents(null), 0);
    assert.equal(cents(''), 0);
    assert.equal(cents('   '), 0);
    assert.equal(cents(false), 0);
    assert.equal(cents(undefined), null);
    assert.equal(cents('abc'), null);
    assert.equal(cents(Number.NaN), null);
    assert.equal(cents(Number.POSITIVE_INFINITY), null);
    assert.equal(cents(Number.NEGATIVE_INFINITY), null);
    assert.equal(cents(true), 1);
  });

  it('refuses a missing, zero, or negative invoice total before creating a charge', () => {
    assert.deepEqual(paymentIntentAmountDue({ total_cents: undefined }, { paid: 0 }), {
      error: 'Invoice total is missing or zero',
    });
    assert.deepEqual(paymentIntentAmountDue({ total_cents: 'nope' }, { paid: 0 }), {
      error: 'Invoice total is missing or zero',
    });
    assert.deepEqual(paymentIntentAmountDue({ total_cents: 0 }, { paid: 0 }), {
      error: 'Invoice total is missing or zero',
    });
    assert.deepEqual(paymentIntentAmountDue({ total_cents: null }, { paid: 0 }), {
      error: 'Invoice total is missing or zero',
    });
    assert.deepEqual(paymentIntentAmountDue({ total_cents: -50 }, { paid: 0 }), {
      error: 'Invoice total is missing or zero',
    });
    assert.deepEqual(paymentIntentAmountDue({ total_cents: 0.4 }, { paid: 0 }), {
      error: 'Invoice total is missing or zero',
    });
  });

  it('rounds half-cents before subtracting payments and blocks an already-paid invoice', () => {
    assert.deepEqual(paymentIntentAmountDue({ total_cents: 10000 }, { paid: null }), {
      amountDue: 10000,
    });
    assert.deepEqual(paymentIntentAmountDue({ total_cents: '10000.4' }, { paid: '4000.4' }), {
      amountDue: 6000,
    });
    assert.deepEqual(paymentIntentAmountDue({ total_cents: 10000 }, { paid: 4000.5 }), {
      amountDue: 5999,
    });
    assert.deepEqual(paymentIntentAmountDue({ total_cents: 0.5 }, { paid: 0 }), {
      amountDue: 1,
    });
    assert.deepEqual(paymentIntentAmountDue({ total_cents: 10000 }, { paid: 'not-a-number' }), {
      amountDue: 10000,
    });
    assert.deepEqual(paymentIntentAmountDue({ total_cents: 10000 }, { paid: 10000 }), {
      error: 'Invoice is already paid',
    });
    assert.deepEqual(paymentIntentAmountDue({ total_cents: 10000 }, { paid: 10000.5 }), {
      error: 'Invoice is already paid',
    });
  });

  it('builds a Stripe client only for a quote-stripped secret key', () => {
    process.env.STRIPE_SECRET_KEY = '  "sk_test_coverage"  ';
    const client = getStripe();
    assert.equal(client.key, 'sk_test_coverage');
    assert.deepEqual(client.options, { apiVersion: '2024-06-20' });

    process.env.STRIPE_SECRET_KEY = "'sk_test_coverage'";
    assert.equal(getStripe().key, 'sk_test_coverage');

    process.env.STRIPE_SECRET_KEY = 'sk_test_coverage"';
    assert.equal(getStripe().key, 'sk_test_coverage');

    process.env.STRIPE_SECRET_KEY = '"sk_test_coverage\'';
    assert.equal(getStripe().key, 'sk_test_coverage');

    for (const rejected of [
      undefined,
      '',
      '   ',
      'pk_test_coverage',
      'rk_test_coverage',
      'SK_test_coverage',
      'sktest_coverage',
      '\'"sk_test_coverage"\'',
    ]) {
      if (rejected === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = rejected;
      assert.equal(getStripe(), null, `rejected ${JSON.stringify(rejected)}`);
    }
  });
});
