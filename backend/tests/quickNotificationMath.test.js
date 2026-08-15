import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateQuickNotificationFields,
  canSendQuickNotification,
  buildQuickNotificationMessage,
  applyQuickNotificationTypeFields,
} from '../utils/quickNotificationMath.js';

describe('validateQuickNotificationFields', () => {
  it('requires taskTitle or taskId plus distributor for parts_arrived', () => {
    assert.deepEqual(
      validateQuickNotificationFields({ type: 'parts_arrived' }),
      { error: 'Missing required field: taskTitle or taskId' }
    );
    assert.deepEqual(
      validateQuickNotificationFields({ type: 'parts_arrived', taskId: 0, taskTitle: '' }),
      { error: 'Missing required field: taskTitle or taskId' }
    );
    assert.deepEqual(
      validateQuickNotificationFields({ type: 'parts_arrived', taskTitle: 'RO-1' }),
      { error: 'Missing required field: distributor' }
    );
    assert.deepEqual(
      validateQuickNotificationFields({ type: 'parts_arrived', taskId: 9, distributor: '' }),
      { error: 'Missing required field: distributor' }
    );
    assert.deepEqual(
      validateQuickNotificationFields({ type: 'parts_arrived', taskTitle: 'RO-1', distributor: 'Turn14' }),
      { ok: true }
    );
    assert.deepEqual(
      validateQuickNotificationFields({ type: 'parts_arrived', taskId: 9, distributor: 'Turn14' }),
      { ok: true }
    );
  });

  it('requires urgency for need_assistance and skips other types', () => {
    assert.deepEqual(
      validateQuickNotificationFields({ type: 'need_assistance' }),
      { error: 'Missing required field: urgency' }
    );
    assert.deepEqual(
      validateQuickNotificationFields({ type: 'need_assistance', urgency: '' }),
      { error: 'Missing required field: urgency' }
    );
    assert.deepEqual(
      validateQuickNotificationFields({ type: 'need_assistance', urgency: 'immediate' }),
      { ok: true }
    );
    assert.deepEqual(validateQuickNotificationFields({ type: 'customer_arrived' }), { ok: true });
    assert.deepEqual(validateQuickNotificationFields({ type: 'unknown' }), { ok: true });
    assert.deepEqual(validateQuickNotificationFields({}), { ok: true });
  });
});

describe('canSendQuickNotification', () => {
  it('blocks only the exact admin role', () => {
    assert.equal(canSendQuickNotification('admin'), false);
    assert.equal(canSendQuickNotification('employee'), true);
    assert.equal(canSendQuickNotification('Admin'), true);
    assert.equal(canSendQuickNotification('administrator'), true);
    assert.equal(canSendQuickNotification(undefined), true);
  });
});

describe('buildQuickNotificationMessage', () => {
  it('prefers vehicle over taskTitle for parts_arrived', () => {
    assert.equal(
      buildQuickNotificationMessage({
        type: 'parts_arrived',
        userName: 'Alex',
        vehicle: '2018 F-150',
        taskTitle: 'Old title',
        distributor: 'Turn14',
      }),
      '📦 Parts Arrived: Alex reports that parts have arrived for 2018 F-150 from Turn14.'
    );
    assert.equal(
      buildQuickNotificationMessage({
        type: 'parts_arrived',
        userName: 'Alex',
        taskTitle: 'RO-1',
        distributor: 'Turn14',
      }),
      '📦 Parts Arrived: Alex reports that parts have arrived for RO-1 from Turn14.'
    );
    assert.equal(
      buildQuickNotificationMessage({
        type: 'parts_arrived',
        userName: 'Alex',
        distributor: 'Turn14',
      }),
      '📦 Parts Arrived: Alex reports that parts have arrived for Unknown Vehicle from Turn14.'
    );
  });

  it('labels immediate vs convenience assistance and customer arrival', () => {
    assert.equal(
      buildQuickNotificationMessage({
        type: 'need_assistance',
        userName: 'Sam',
        urgency: 'immediate',
      }),
      '🚨 IMMEDIATE Assistance Needed: Sam needs assistance (urgent).'
    );
    assert.equal(
      buildQuickNotificationMessage({
        type: 'need_assistance',
        userName: 'Sam',
        urgency: 'later',
      }),
      '⏰ At First Convenience Assistance Needed: Sam needs assistance (when convenient).'
    );
    assert.equal(
      buildQuickNotificationMessage({ type: 'customer_arrived', userName: 'Sam' }),
      '👋 Customer Arrived: Sam reports that a customer has arrived at the shop.'
    );
    assert.equal(
      buildQuickNotificationMessage({ type: 'other', userName: 'Sam' }),
      '🔔 Quick Notification: Sam sent a notification.'
    );
  });
});

describe('applyQuickNotificationTypeFields', () => {
  it('adds parts_arrived fields and omits falsy taskId', () => {
    const withId = applyQuickNotificationTypeFields({}, {
      type: 'parts_arrived',
      taskId: 12,
      taskTitle: 'RO-1',
      distributor: 'Turn14',
    });
    assert.deepEqual(withId, { taskId: 12, taskTitle: 'RO-1', distributor: 'Turn14' });

    const noId = applyQuickNotificationTypeFields({}, {
      type: 'parts_arrived',
      taskId: 0,
      distributor: 'Turn14',
    });
    assert.deepEqual(noId, { taskTitle: 'Unknown Task', distributor: 'Turn14' });
  });

  it('copies urgency for assistance and leaves other types untouched', () => {
    assert.deepEqual(
      applyQuickNotificationTypeFields({}, { type: 'need_assistance', urgency: 'immediate' }),
      { urgency: 'immediate' }
    );
    assert.deepEqual(
      applyQuickNotificationTypeFields({ type: 'customer_arrived' }, { type: 'customer_arrived' }),
      { type: 'customer_arrived' }
    );
  });
});
