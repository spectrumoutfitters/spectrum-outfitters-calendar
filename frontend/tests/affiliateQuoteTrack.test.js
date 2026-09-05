import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildAffiliateQuoteIframeSrc,
  extractAffiliateTrackIds,
  normalizeAffiliateToken,
  unwrapAffiliateMessageData,
} from '../src/utils/affiliateQuoteTrack.js';

describe('normalizeAffiliateToken', () => {
  it('trims; falsy including numeric 0 becomes empty; string 0 is kept', () => {
    assert.equal(normalizeAffiliateToken(null), '');
    assert.equal(normalizeAffiliateToken(undefined), '');
    assert.equal(normalizeAffiliateToken(0), '');
    assert.equal(normalizeAffiliateToken(''), '');
    assert.equal(normalizeAffiliateToken('  '), '');
    assert.equal(normalizeAffiliateToken('0'), '0');
    assert.equal(normalizeAffiliateToken(' abc '), 'abc');
  });
});

describe('buildAffiliateQuoteIframeSrc', () => {
  it('embeds the token in query params used for later webhook matching', () => {
    const src = buildAffiliateQuoteIframeSrc('tok_1');
    assert.match(src, /^https:\/\/app\.shopmonkey\.cloud\/public\/quote-request\//);
    const qs = src.slice(src.indexOf('?'));
    const params = new URLSearchParams(qs);
    assert.equal(params.get('noExternalScripts'), '1');
    assert.equal(params.get('affiliateToken'), 'tok_1');
    assert.equal(params.get('note'), 'AFFILIATE_TOKEN:tok_1');
    assert.equal(params.get('description'), 'AFFILIATE_TOKEN:tok_1');
  });
});

describe('unwrapAffiliateMessageData', () => {
  it('rejects falsy and non-objects (strings / numbers)', () => {
    assert.equal(unwrapAffiliateMessageData(null), null);
    assert.equal(unwrapAffiliateMessageData(undefined), null);
    assert.equal(unwrapAffiliateMessageData(0), null);
    assert.equal(unwrapAffiliateMessageData(''), null);
    assert.equal(unwrapAffiliateMessageData('{"orderId":1}'), null);
    assert.equal(unwrapAffiliateMessageData(12), null);
  });

  it('uses nested data only when it is a truthy object (arrays included)', () => {
    assert.deepEqual(unwrapAffiliateMessageData({ orderId: 9 }), { orderId: 9 });
    assert.deepEqual(unwrapAffiliateMessageData({ data: { orderId: 9 } }), { orderId: 9 });
    assert.deepEqual(unwrapAffiliateMessageData({ data: 'nope', orderId: 9 }), { data: 'nope', orderId: 9 });
    assert.deepEqual(unwrapAffiliateMessageData({ data: 0, orderId: 9 }), { data: 0, orderId: 9 });
    assert.deepEqual(unwrapAffiliateMessageData({ data: [], orderId: 9 }), []);
  });
});

describe('extractAffiliateTrackIds', () => {
  it('returns null when every ID is missing or falsy (including 0)', () => {
    assert.equal(extractAffiliateTrackIds(null), null);
    assert.equal(extractAffiliateTrackIds({}), null);
    assert.equal(extractAffiliateTrackIds({ workRequestId: 0, orderId: '', customerId: null }), null);
    assert.equal(extractAffiliateTrackIds({ data: { orderId: 0 } }), null);
  });

  it('accepts camelCase / snake_case / nested .id variants via ||', () => {
    assert.deepEqual(extractAffiliateTrackIds({ workRequestId: 'wr1' }), {
      workRequestId: 'wr1',
      orderId: null,
      customerId: null,
    });
    assert.deepEqual(extractAffiliateTrackIds({ work_request_id: 'wr2' }), {
      workRequestId: 'wr2',
      orderId: null,
      customerId: null,
    });
    assert.deepEqual(extractAffiliateTrackIds({ workRequest: { id: 'wr3' } }), {
      workRequestId: 'wr3',
      orderId: null,
      customerId: null,
    });
    assert.deepEqual(extractAffiliateTrackIds({ work_request: { id: 'wr4' } }), {
      workRequestId: 'wr4',
      orderId: null,
      customerId: null,
    });
    assert.deepEqual(extractAffiliateTrackIds({ order_id: 'o1', customer: { id: 'c1' } }), {
      workRequestId: null,
      orderId: 'o1',
      customerId: 'c1',
    });
    assert.deepEqual(extractAffiliateTrackIds({ data: { orderId: 'o2', customer_id: 'c2' } }), {
      workRequestId: null,
      orderId: 'o2',
      customerId: 'c2',
    });
  });

  it('keeps string 0 IDs (truthy) and prefers the first || hit', () => {
    assert.deepEqual(extractAffiliateTrackIds({ orderId: '0' }), {
      workRequestId: null,
      orderId: '0',
      customerId: null,
    });
    assert.deepEqual(
      extractAffiliateTrackIds({ workRequestId: 'first', work_request_id: 'second' }),
      { workRequestId: 'first', orderId: null, customerId: null },
    );
  });
});
