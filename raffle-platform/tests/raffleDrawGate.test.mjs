import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isMissingRaffleId, parseDrawBody } from '../src/lib/raffleDrawGate.js';

describe('isMissingRaffleId', () => {
  it('treats falsy raffleId as missing (string "0" is present)', () => {
    assert.equal(isMissingRaffleId(undefined), true);
    assert.equal(isMissingRaffleId(null), true);
    assert.equal(isMissingRaffleId(''), true);
    assert.equal(isMissingRaffleId(0), true);
    assert.equal(isMissingRaffleId(false), true);
    assert.equal(isMissingRaffleId('pool-a'), false);
    assert.equal(isMissingRaffleId('0'), false);
  });
});

describe('parseDrawBody', () => {
  it('rejects missing raffleId and forwards a present id unchanged', () => {
    assert.deepEqual(parseDrawBody({}), { ok: false, error: 'missing_raffleId' });
    assert.deepEqual(parseDrawBody(undefined), { ok: false, error: 'missing_raffleId' });
    assert.deepEqual(parseDrawBody({ raffleId: '' }), { ok: false, error: 'missing_raffleId' });
    assert.equal(parseDrawBody({ raffleId: 'pool-a' }).ok, true);
    assert.equal(parseDrawBody({ raffleId: 'pool-a' }).raffleId, 'pool-a');
    assert.equal(parseDrawBody({ raffleId: '0' }).raffleId, '0');
  });

  it('defaults excludePhones only for null/undefined (non-arrays pass through)', () => {
    assert.deepEqual(parseDrawBody({ raffleId: 'p' }).excludePhones, []);
    assert.deepEqual(parseDrawBody({ raffleId: 'p', excludePhones: null }).excludePhones, []);
    assert.deepEqual(parseDrawBody({ raffleId: 'p', excludePhones: [] }).excludePhones, []);
    assert.deepEqual(
      parseDrawBody({ raffleId: 'p', excludePhones: ['+15551212'] }).excludePhones,
      ['+15551212'],
    );
    assert.equal(parseDrawBody({ raffleId: 'p', excludePhones: 'not-array' }).excludePhones, 'not-array');
  });

  it('coerces testModeOnly with Boolean() so the string "false" is true', () => {
    assert.equal(parseDrawBody({ raffleId: 'p' }).testModeOnly, false);
    assert.equal(parseDrawBody({ raffleId: 'p', testModeOnly: false }).testModeOnly, false);
    assert.equal(parseDrawBody({ raffleId: 'p', testModeOnly: 0 }).testModeOnly, false);
    assert.equal(parseDrawBody({ raffleId: 'p', testModeOnly: true }).testModeOnly, true);
    assert.equal(parseDrawBody({ raffleId: 'p', testModeOnly: 1 }).testModeOnly, true);
    assert.equal(parseDrawBody({ raffleId: 'p', testModeOnly: 'false' }).testModeOnly, true);
  });
});
