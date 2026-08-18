import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePushBroadcastTarget,
  isBroadcastPayloadMissing,
  hasPushSubscriptionFields,
  hasUnsubscribeEndpoint,
  EMPLOYEE_BROADCAST_SQL,
} from '../utils/pushBroadcastTarget.js';

describe('resolvePushBroadcastTarget', () => {
  it('special-cases only the exact strings admins and employees', () => {
    assert.equal(resolvePushBroadcastTarget('admins'), 'admins');
    assert.equal(resolvePushBroadcastTarget('employees'), 'employees');
  });

  it('sends to everyone for any other target, including lookalikes and omitted', () => {
    assert.equal(resolvePushBroadcastTarget('all'), 'all');
    assert.equal(resolvePushBroadcastTarget('Admins'), 'all');
    assert.equal(resolvePushBroadcastTarget('Employees'), 'all');
    assert.equal(resolvePushBroadcastTarget('admin'), 'all');
    assert.equal(resolvePushBroadcastTarget('employee'), 'all');
    assert.equal(resolvePushBroadcastTarget('ADMINS'), 'all');
    assert.equal(resolvePushBroadcastTarget(''), 'all');
    assert.equal(resolvePushBroadcastTarget(undefined), 'all');
    assert.equal(resolvePushBroadcastTarget(null), 'all');
    assert.equal(resolvePushBroadcastTarget(true), 'all');
  });
});

describe('isBroadcastPayloadMissing', () => {
  it('requires truthy title and body (empty string and 0 are missing)', () => {
    assert.equal(isBroadcastPayloadMissing('Hello', 'World'), false);
    assert.equal(isBroadcastPayloadMissing('', 'World'), true);
    assert.equal(isBroadcastPayloadMissing('Hello', ''), true);
    assert.equal(isBroadcastPayloadMissing(null, 'World'), true);
    assert.equal(isBroadcastPayloadMissing('Hello', undefined), true);
    assert.equal(isBroadcastPayloadMissing(0, 'World'), true);
    assert.equal(isBroadcastPayloadMissing('Hello', 0), true);
  });
});

describe('hasPushSubscriptionFields', () => {
  it('requires endpoint plus keys.p256dh and keys.auth', () => {
    assert.equal(
      hasPushSubscriptionFields({
        endpoint: 'https://push.example/sub',
        keys: { p256dh: 'pk', auth: 'ak' },
      }),
      true
    );
    assert.equal(
      hasPushSubscriptionFields({
        endpoint: 'https://push.example/sub',
        keys: { p256dh: 'pk' },
      }),
      false
    );
    assert.equal(
      hasPushSubscriptionFields({
        endpoint: 'https://push.example/sub',
        keys: { auth: 'ak' },
      }),
      false
    );
    assert.equal(
      hasPushSubscriptionFields({ endpoint: 'https://push.example/sub' }),
      false
    );
    assert.equal(
      hasPushSubscriptionFields({
        endpoint: '',
        keys: { p256dh: 'pk', auth: 'ak' },
      }),
      false
    );
    assert.equal(hasPushSubscriptionFields(undefined), false);
    assert.equal(hasPushSubscriptionFields({}), false);
  });
});

describe('hasUnsubscribeEndpoint', () => {
  it('rejects falsy endpoints', () => {
    assert.equal(hasUnsubscribeEndpoint('https://push.example/sub'), true);
    assert.equal(hasUnsubscribeEndpoint(''), false);
    assert.equal(hasUnsubscribeEndpoint(undefined), false);
    assert.equal(hasUnsubscribeEndpoint(0), false);
  });
});

describe('EMPLOYEE_BROADCAST_SQL', () => {
  it('targets exact employee role and is_active = 1 only', () => {
    assert.equal(
      EMPLOYEE_BROADCAST_SQL,
      "SELECT id FROM users WHERE role = 'employee' AND is_active = 1"
    );
    assert.equal(EMPLOYEE_BROADCAST_SQL.includes("role = 'employee'"), true);
    assert.equal(EMPLOYEE_BROADCAST_SQL.includes("role = 'Employee'"), false);
    assert.equal(EMPLOYEE_BROADCAST_SQL.includes('is_active = 1'), true);
    assert.equal(EMPLOYEE_BROADCAST_SQL.includes('is_active != 0'), false);
  });
});
