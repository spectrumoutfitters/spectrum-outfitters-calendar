import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canSendNeedAssistance,
  needAssistanceError,
  buildNeedAssistancePayload,
  formatNeedAssistanceUrgency,
} from '../src/utils/needAssistanceNotifyGate.js';

describe('canSendNeedAssistance / needAssistanceError', () => {
  it('blocks send until an urgency is chosen', () => {
    assert.equal(canSendNeedAssistance(''), false);
    assert.equal(canSendNeedAssistance(null), false);
    assert.equal(canSendNeedAssistance(undefined), false);
    assert.equal(needAssistanceError(''), 'Please select an urgency level');
    assert.equal(needAssistanceError(null), 'Please select an urgency level');
  });

  it('allows immediate and convenience', () => {
    assert.equal(canSendNeedAssistance('immediate'), true);
    assert.equal(canSendNeedAssistance('convenience'), true);
    assert.equal(needAssistanceError('immediate'), null);
    assert.equal(needAssistanceError('convenience'), null);
  });
});

describe('buildNeedAssistancePayload', () => {
  it('sends the chosen urgency unchanged', () => {
    assert.deepEqual(buildNeedAssistancePayload('immediate'), {
      type: 'need_assistance',
      urgency: 'immediate',
    });
    assert.deepEqual(buildNeedAssistancePayload('convenience'), {
      type: 'need_assistance',
      urgency: 'convenience',
    });
  });
});

describe('formatNeedAssistanceUrgency', () => {
  it('treats only exact immediate as urgent; other truthy values are convenience', () => {
    assert.equal(formatNeedAssistanceUrgency('immediate'), 'Immediate');
    assert.equal(formatNeedAssistanceUrgency('convenience'), 'At First Convenience');
    assert.equal(formatNeedAssistanceUrgency('IMMEDIATE'), 'At First Convenience');
    assert.equal(formatNeedAssistanceUrgency('urgent'), 'At First Convenience');
  });
});
