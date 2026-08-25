import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { coerceEventConfigSave, isMissingAdminKey } from '../src/lib/adminEventConfigGate.js';

describe('isMissingAdminKey', () => {
  it('requires a non-empty trimmed x-admin-key', () => {
    assert.equal(isMissingAdminKey('secret'), false);
    assert.equal(isMissingAdminKey('  secret  '), false);
    assert.equal(isMissingAdminKey(''), true);
    assert.equal(isMissingAdminKey('   '), true);
    assert.equal(isMissingAdminKey(null), true);
    assert.equal(isMissingAdminKey(undefined), true);
    assert.equal(isMissingAdminKey(0), true);
  });
});

describe('coerceEventConfigSave', () => {
  it('keeps a real raffles array and event object', () => {
    const raffles = [{ id: 'a' }];
    const event = { name: 'Draw' };
    assert.deepEqual(coerceEventConfigSave({ event, raffles }), { event, raffles });
    assert.deepEqual(coerceEventConfigSave({ event, raffles: [] }), { event, raffles: [] });
  });

  it('coerces non-array raffles to [] so objects/strings are not saved as the raffle list', () => {
    assert.deepEqual(coerceEventConfigSave({ raffles: { 0: { id: 'a' } } }).raffles, []);
    assert.deepEqual(coerceEventConfigSave({ raffles: 'oops' }).raffles, []);
    assert.deepEqual(coerceEventConfigSave({ raffles: null }).raffles, []);
    assert.deepEqual(coerceEventConfigSave({}).raffles, []);
    assert.deepEqual(coerceEventConfigSave(undefined).raffles, []);
    assert.deepEqual(coerceEventConfigSave({ raffles: 0 }).raffles, []);
  });

  it('replaces falsy event with {}', () => {
    assert.deepEqual(coerceEventConfigSave({ event: null }).event, {});
    assert.deepEqual(coerceEventConfigSave({ event: 0 }).event, {});
    assert.deepEqual(coerceEventConfigSave({ event: '' }).event, {});
    assert.deepEqual(coerceEventConfigSave({}).event, {});
    assert.deepEqual(coerceEventConfigSave({ event: { name: 'x' } }).event, { name: 'x' });
  });
});
