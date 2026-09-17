import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canSendBroadcast, buildBroadcastPayload } from '../src/utils/adminBroadcastGate.js';

describe('canSendBroadcast', () => {
  it('requires non-empty trimmed title and body', () => {
    assert.equal(canSendBroadcast('Alert', 'Shop closed'), true);
    assert.equal(canSendBroadcast('  Alert  ', '  Shop closed  '), true);
    assert.equal(canSendBroadcast('', 'Shop closed'), false);
    assert.equal(canSendBroadcast('Alert', ''), false);
    assert.equal(canSendBroadcast('   ', 'Shop closed'), false);
    assert.equal(canSendBroadcast('Alert', '   '), false);
    assert.equal(canSendBroadcast(null, 'Shop closed'), false);
    assert.equal(canSendBroadcast('Alert', undefined), false);
  });
});

describe('buildBroadcastPayload', () => {
  it('trims title and body and passes target through', () => {
    assert.deepEqual(buildBroadcastPayload('  Parts  ', '  In stock  ', 'employees'), {
      title: 'Parts',
      body: 'In stock',
      target: 'employees',
    });
    assert.deepEqual(buildBroadcastPayload('All-hands', 'Meeting', 'admins'), {
      title: 'All-hands',
      body: 'Meeting',
      target: 'admins',
    });
    assert.equal(buildBroadcastPayload('T', 'B', 'all').target, 'all');
  });
});
