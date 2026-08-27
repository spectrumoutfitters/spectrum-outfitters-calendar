import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  TURN14_PLACEHOLDER_CLIENT_ID,
  TURN14_PLACEHOLDER_CLIENT_SECRET,
  isTurn14ConfiguredForApi,
  isTurn14ConfiguredForTest,
  isTurn14EnvSet,
  isTurn14SecretPresent,
  turn14PricingQuantity,
} from '../utils/turn14CredentialsGate.js';

describe('isTurn14SecretPresent / isTurn14EnvSet', () => {
  it('treats empty, null, and whitespace-only as missing; any other string as present', () => {
    assert.equal(isTurn14SecretPresent(''), false);
    assert.equal(isTurn14SecretPresent(null), false);
    assert.equal(isTurn14SecretPresent(undefined), false);
    assert.equal(isTurn14SecretPresent('   '), false);
    assert.equal(isTurn14SecretPresent('real-id'), true);
    assert.equal(isTurn14SecretPresent(TURN14_PLACEHOLDER_CLIENT_ID), true);
  });

  it('error-handler env-set flag is looser: whitespace-only still counts', () => {
    assert.equal(isTurn14EnvSet('', 'secret'), false);
    assert.equal(isTurn14EnvSet('id', ''), false);
    assert.equal(isTurn14EnvSet('  ', '  '), true);
    assert.equal(isTurn14EnvSet(TURN14_PLACEHOLDER_CLIENT_ID, TURN14_PLACEHOLDER_CLIENT_SECRET), true);
  });
});

describe('isTurn14ConfiguredForTest vs isTurn14ConfiguredForApi', () => {
  it('both reject missing / whitespace secrets', () => {
    assert.equal(isTurn14ConfiguredForTest('', 'secret'), false);
    assert.equal(isTurn14ConfiguredForApi('', 'secret'), false);
    assert.equal(isTurn14ConfiguredForTest('id', '   '), false);
    assert.equal(isTurn14ConfiguredForApi('id', '   '), false);
  });

  it('placeholders fail /test but still count as configured for search/orders', () => {
    assert.equal(
      isTurn14ConfiguredForTest(TURN14_PLACEHOLDER_CLIENT_ID, 'real-secret'),
      false,
    );
    assert.equal(
      isTurn14ConfiguredForTest('real-id', TURN14_PLACEHOLDER_CLIENT_SECRET),
      false,
    );
    assert.equal(
      isTurn14ConfiguredForTest(TURN14_PLACEHOLDER_CLIENT_ID, TURN14_PLACEHOLDER_CLIENT_SECRET),
      false,
    );
    assert.equal(
      isTurn14ConfiguredForApi(TURN14_PLACEHOLDER_CLIENT_ID, TURN14_PLACEHOLDER_CLIENT_SECRET),
      true,
    );
    assert.equal(
      isTurn14ConfiguredForApi(TURN14_PLACEHOLDER_CLIENT_ID, 'real-secret'),
      true,
    );
  });

  it('placeholder compare is exact (no trim): padded placeholder still passes /test', () => {
    assert.equal(
      isTurn14ConfiguredForTest(` ${TURN14_PLACEHOLDER_CLIENT_ID}`, 'real-secret'),
      true,
    );
  });

  it('real credentials pass both gates', () => {
    assert.equal(isTurn14ConfiguredForTest('real-id', 'real-secret'), true);
    assert.equal(isTurn14ConfiguredForApi('real-id', 'real-secret'), true);
  });
});

describe('turn14PricingQuantity', () => {
  it('uses parseInt when quantity is truthy, otherwise 1 (including 0)', () => {
    assert.equal(turn14PricingQuantity(undefined), 1);
    assert.equal(turn14PricingQuantity(''), 1);
    assert.equal(turn14PricingQuantity(null), 1);
    assert.equal(turn14PricingQuantity(0), 1);
    assert.equal(turn14PricingQuantity('0'), 0);
    assert.equal(turn14PricingQuantity('3'), 3);
    assert.equal(turn14PricingQuantity('2abc'), 2);
    assert.equal(Number.isNaN(turn14PricingQuantity('abc')), true);
  });
});
