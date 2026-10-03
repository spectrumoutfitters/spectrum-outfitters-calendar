import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  bulkApproveBlockReason,
  systemUpdateEditFlags,
  systemUpdateReadPercentage,
  systemUpdateRowFlags,
  systemUpdateSaveMessage,
} from '../src/utils/systemUpdateForm.js';

describe('systemUpdateEditFlags', () => {
  it('checks boxes only for numeric 1', () => {
    assert.deepEqual(
      systemUpdateEditFlags({ show_on_login: 1, is_active: 1 }),
      { show_on_login: true, is_active: true },
    );
    assert.deepEqual(
      systemUpdateEditFlags({ show_on_login: 0, is_active: 0 }),
      { show_on_login: false, is_active: false },
    );
    assert.deepEqual(
      systemUpdateEditFlags({ show_on_login: true, is_active: '1' }),
      { show_on_login: false, is_active: false },
    );
  });
});

describe('systemUpdateRowFlags', () => {
  it('shows pending only for is_pending === 1 and hides the login badge until then', () => {
    assert.deepEqual(
      systemUpdateRowFlags({ is_pending: 1, is_active: 1, show_on_login: 1 }),
      { pending: true, active: true, showOnLogin: false },
    );
    assert.deepEqual(
      systemUpdateRowFlags({ is_pending: 0, is_active: 1, show_on_login: 1 }),
      { pending: false, active: true, showOnLogin: true },
    );
    assert.deepEqual(
      systemUpdateRowFlags({ is_pending: 0, is_active: 0, show_on_login: 0 }),
      { pending: false, active: false, showOnLogin: false },
    );
  });

  it('does not treat string 1 as pending, so the login badge can still appear', () => {
    assert.deepEqual(
      systemUpdateRowFlags({ is_pending: '1', is_active: 0, show_on_login: 1 }),
      { pending: false, active: false, showOnLogin: true },
    );
  });
});

describe('systemUpdateReadPercentage', () => {
  it('returns 0 when there is no audience and otherwise rounds', () => {
    assert.equal(systemUpdateReadPercentage(3, 0), 0);
    assert.equal(systemUpdateReadPercentage(3, null), 0);
    assert.equal(systemUpdateReadPercentage(1, 2), 50);
    assert.equal(systemUpdateReadPercentage(1, 3), 33);
    assert.equal(systemUpdateReadPercentage(2, 3), 67);
  });
});

describe('systemUpdateSaveMessage', () => {
  it('distinguishes edit, immediate publish, and pending create', () => {
    assert.equal(systemUpdateSaveMessage(true, true), 'Update updated successfully!');
    assert.equal(systemUpdateSaveMessage(false, true), 'Update created and published immediately!');
    assert.equal(systemUpdateSaveMessage(false, false), 'Update created and pending approval!');
  });
});

describe('bulkApproveBlockReason', () => {
  it('blocks an empty selection and allows a non-zero count', () => {
    assert.equal(bulkApproveBlockReason(0), 'Please select at least one update to approve');
    assert.equal(bulkApproveBlockReason(2), null);
  });
});
