import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  entriesDataEndRow,
  shouldRewriteEntryRowOnUpdate,
  shouldSkipPaidApplyDueToRefund,
} from "./raffleSheetGuards.js";

describe("entriesDataEndRow", () => {
  it("includes the last data row (never lastRow-1)", () => {
    assert.equal(entriesDataEndRow(2), 2);
    assert.equal(entriesDataEndRow(10), 10);
  });

  it("returns null when there is no data row", () => {
    assert.equal(entriesDataEndRow(1), null);
    assert.equal(entriesDataEndRow(0), null);
  });
});

describe("shouldRewriteEntryRowOnUpdate", () => {
  it("never rewrites paid rows", () => {
    assert.equal(shouldRewriteEntryRowOnUpdate({ __paid: true }, true), false);
    assert.equal(shouldRewriteEntryRowOnUpdate({ __paid: true, __newsletterBonus: true }, true), false);
  });

  it("rewrites free rows", () => {
    assert.equal(shouldRewriteEntryRowOnUpdate({ __newsletterOptIn: true }, true), true);
    assert.equal(shouldRewriteEntryRowOnUpdate({}, false), true);
  });

  it("deletes legacy newsletter bonus rows when opt-in is folded into free totals", () => {
    assert.equal(shouldRewriteEntryRowOnUpdate({ __newsletterBonus: true }, true), true);
  });

  it("preserves legacy newsletter bonus rows when newsletter is not opted in", () => {
    assert.equal(shouldRewriteEntryRowOnUpdate({ __newsletterBonus: true }, false), false);
  });
});

describe("shouldSkipPaidApplyDueToRefund", () => {
  it("skips when Script Properties deny-list is set (refund-before-fulfillment)", () => {
    assert.equal(shouldSkipPaidApplyDueToRefund({ propertyMarked: true, sheetHasRefundedSession: false }), true);
  });

  it("skips when sheet rows already carry __refunded for the session", () => {
    assert.equal(shouldSkipPaidApplyDueToRefund({ propertyMarked: false, sheetHasRefundedSession: true }), true);
  });

  it("allows apply when neither marker is present", () => {
    assert.equal(shouldSkipPaidApplyDueToRefund({ propertyMarked: false, sheetHasRefundedSession: false }), false);
  });
});
