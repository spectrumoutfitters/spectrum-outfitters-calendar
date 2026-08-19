import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAffiliateTrackToken,
  isAffiliateTrackTokenMissing,
  shopmonkeyIdString,
  normalizeShopmonkeyTrackIds,
  buildTrackDedupeClause,
  serializeTrackRawJson,
  parseOptionalPositiveId,
  parseRequiredPositiveId,
  shouldSettleAffiliateCommission,
} from '../utils/affiliateTrackMath.js';

describe('parseAffiliateTrackToken', () => {
  it('prefers affiliate_token over token and trims', () => {
    assert.equal(parseAffiliateTrackToken({ affiliate_token: '  abc  ', token: 'zzz' }), 'abc');
    assert.equal(parseAffiliateTrackToken({ token: ' from-token ' }), 'from-token');
  });

  it('treats 0 / empty as missing via || fallback', () => {
    assert.equal(parseAffiliateTrackToken({ affiliate_token: 0, token: 'fallback' }), 'fallback');
    assert.equal(parseAffiliateTrackToken({ affiliate_token: '', token: 'x' }), 'x');
    assert.equal(parseAffiliateTrackToken({}), '');
    assert.equal(parseAffiliateTrackToken(undefined), '');
  });
});

describe('isAffiliateTrackTokenMissing', () => {
  it('is true only for falsy tokens', () => {
    assert.equal(isAffiliateTrackTokenMissing(''), true);
    assert.equal(isAffiliateTrackTokenMissing('tok'), false);
  });
});

describe('shopmonkeyIdString / normalizeShopmonkeyTrackIds', () => {
  it('stringifies 0 and false because != null', () => {
    assert.equal(shopmonkeyIdString(0), '0');
    assert.equal(shopmonkeyIdString(false), 'false');
    assert.equal(shopmonkeyIdString(null), null);
    assert.equal(shopmonkeyIdString(undefined), null);
  });

  it('keeps empty string (later skipped by truthiness in OR-dedupe)', () => {
    const ids = normalizeShopmonkeyTrackIds({
      shopmonkey_work_request_id: '',
      shopmonkey_order_id: 99,
      shopmonkey_customer_id: null,
    });
    assert.equal(ids.workRequestId, '');
    assert.equal(ids.orderId, '99');
    assert.equal(ids.customerId, null);
  });
});

describe('buildTrackDedupeClause', () => {
  it('ORs every truthy ShopMonkey id and skips empty string', () => {
    const clause = buildTrackDedupeClause({
      workRequestId: 'wr-1',
      orderId: '',
      customerId: 'cust-9',
    });
    assert.equal(clause.canDedupe, true);
    assert.deepEqual(clause.whereParts, [
      'shopmonkey_work_request_id = ?',
      'shopmonkey_customer_id = ?',
    ]);
    assert.deepEqual(clause.extraParams, ['wr-1', 'cust-9']);
  });

  it('includes String(0) order id as a dedupe key', () => {
    const clause = buildTrackDedupeClause({
      workRequestId: null,
      orderId: '0',
      customerId: null,
    });
    assert.equal(clause.canDedupe, true);
    assert.deepEqual(clause.whereParts, ['shopmonkey_order_id = ?']);
    assert.deepEqual(clause.extraParams, ['0']);
  });

  it('cannot dedupe when all ids are omitted', () => {
    const clause = buildTrackDedupeClause({ workRequestId: null, orderId: null, customerId: '' });
    assert.equal(clause.canDedupe, false);
    assert.deepEqual(clause.whereParts, []);
    assert.deepEqual(clause.extraParams, []);
  });
});

describe('serializeTrackRawJson', () => {
  it('stringifies nested raw_json when truthy', () => {
    assert.equal(serializeTrackRawJson({ raw_json: { a: 1 }, token: 'x' }), '{"a":1}');
  });

  it('falls back to the whole body when raw_json is falsy (including 0)', () => {
    assert.equal(serializeTrackRawJson({ raw_json: 0, token: 'x' }), '{"raw_json":0,"token":"x"}');
    assert.equal(serializeTrackRawJson(undefined), '{}');
  });
});

describe('parseOptionalPositiveId / parseRequiredPositiveId', () => {
  it('omits nullish assigned_user_id / crm_invoice_id', () => {
    assert.deepEqual(parseOptionalPositiveId(null), { value: null, invalid: false });
    assert.deepEqual(parseOptionalPositiveId(undefined), { value: null, invalid: false });
  });

  it('rejects 0, negatives, and NaN (0 is != null then fails <= 0)', () => {
    assert.equal(parseOptionalPositiveId(0).invalid, true);
    assert.equal(parseOptionalPositiveId(-1).invalid, true);
    assert.equal(parseOptionalPositiveId('abc').invalid, true);
    assert.equal(parseRequiredPositiveId('0').invalid, true);
    assert.equal(parseRequiredPositiveId('').invalid, true);
  });

  it('accepts numeric strings > 0', () => {
    assert.deepEqual(parseOptionalPositiveId('12'), { value: 12, invalid: false });
    assert.deepEqual(parseRequiredPositiveId('7'), { value: 7, invalid: false });
  });
});

describe('shouldSettleAffiliateCommission', () => {
  it('requires customer id, paid invoice id, and unpaid submission id', () => {
    assert.equal(
      shouldSettleAffiliateCommission({
        customerId: 'c1',
        firstPaidInvoice: { id: 10 },
        earliestSubmission: { id: 3 },
      }),
      true
    );
    assert.equal(shouldSettleAffiliateCommission({ customerId: '', firstPaidInvoice: { id: 1 }, earliestSubmission: { id: 2 } }), false);
    assert.equal(shouldSettleAffiliateCommission({ customerId: 'c1', firstPaidInvoice: {}, earliestSubmission: { id: 2 } }), false);
    assert.equal(shouldSettleAffiliateCommission({ customerId: 'c1', firstPaidInvoice: { id: 1 }, earliestSubmission: {} }), false);
  });
});
