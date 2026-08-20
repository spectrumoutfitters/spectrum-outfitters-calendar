import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getActiveProcessor,
  isValorConfigured,
  VALOR_PROCESSOR,
  STRIPE_PROCESSOR,
} from '../utils/paymentProcessorGate.js';

const ENV_KEYS = ['VALOR_PAY_DISABLED', 'VALOR_APP_ID', 'VALOR_APP_KEY'];

describe('isValorConfigured / getActiveProcessor', () => {
  const saved = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
    delete process.env.VALOR_PAY_DISABLED;
    delete process.env.VALOR_APP_ID;
    delete process.env.VALOR_APP_KEY;
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('requires both app id and key after trim and quote-strip', () => {
    assert.equal(isValorConfigured(), false);
    process.env.VALOR_APP_ID = 'app';
    assert.equal(isValorConfigured(), false);
    process.env.VALOR_APP_KEY = 'key';
    assert.equal(isValorConfigured(), true);
    process.env.VALOR_APP_ID = '  "app"  ';
    process.env.VALOR_APP_KEY = "'key'";
    assert.equal(isValorConfigured(), true);
    process.env.VALOR_APP_ID = '   ';
    assert.equal(isValorConfigured(), false);
  });

  it('disables only on 1 / true / yes (case-insensitive); on and 0 stay enabled', () => {
    process.env.VALOR_APP_ID = 'app';
    process.env.VALOR_APP_KEY = 'key';
    process.env.VALOR_PAY_DISABLED = 'TRUE';
    assert.equal(isValorConfigured(), false);
    process.env.VALOR_PAY_DISABLED = 'Yes';
    assert.equal(isValorConfigured(), false);
    process.env.VALOR_PAY_DISABLED = '1';
    assert.equal(isValorConfigured(), false);
    process.env.VALOR_PAY_DISABLED = 'on';
    assert.equal(isValorConfigured(), true);
    process.env.VALOR_PAY_DISABLED = '0';
    assert.equal(isValorConfigured(), true);
  });

  it('labels Valor when configured and Stripe otherwise (even with no Stripe key)', () => {
    assert.equal(getActiveProcessor(), STRIPE_PROCESSOR);
    assert.equal(STRIPE_PROCESSOR, 'stripe');
    process.env.VALOR_APP_ID = 'app';
    process.env.VALOR_APP_KEY = 'key';
    assert.equal(getActiveProcessor(), VALOR_PROCESSOR);
    assert.equal(VALOR_PROCESSOR, 'valorpay');
  });
});
