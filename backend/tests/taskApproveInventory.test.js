import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveTaskApproveDeductQty,
  quantityAfterApproveDeduct,
  shouldApplyTaskApproveInventory,
} from '../utils/taskApproveInventory.js';

describe('taskApproveInventory', () => {
  it('defaults missing/zero linked qty to 1', () => {
    assert.equal(resolveTaskApproveDeductQty(null), 1);
    assert.equal(resolveTaskApproveDeductQty(0), 1);
    assert.equal(resolveTaskApproveDeductQty(undefined), 1);
    assert.equal(resolveTaskApproveDeductQty(4.5), 4.5);
  });

  it('floors stock at zero without absolute stale writes', () => {
    assert.equal(quantityAfterApproveDeduct(10, 4), 6);
    assert.equal(quantityAfterApproveDeduct(3, 10), 0);
    const afterFirst = quantityAfterApproveDeduct(10, 8);
    assert.equal(afterFirst, 2);
    assert.equal(quantityAfterApproveDeduct(afterFirst, 8), 0);
  });

  it('skips inventory when task already admin_approved', () => {
    assert.equal(shouldApplyTaskApproveInventory({ admin_approved: 0 }), true);
    assert.equal(shouldApplyTaskApproveInventory({ admin_approved: false }), true);
    assert.equal(shouldApplyTaskApproveInventory({ admin_approved: 1 }), false);
    assert.equal(shouldApplyTaskApproveInventory({ admin_approved: true }), false);
  });

  it('treats status→completed as requiring first-finalize (not already approved)', () => {
    // Mirrors Kanban/mark-done: completed with admin_approved still 0 must deduct.
    assert.equal(
      shouldApplyTaskApproveInventory({ status: 'completed', admin_approved: 0 }),
      true
    );
    assert.equal(
      shouldApplyTaskApproveInventory({ status: 'completed', admin_approved: 1 }),
      false
    );
  });
});
