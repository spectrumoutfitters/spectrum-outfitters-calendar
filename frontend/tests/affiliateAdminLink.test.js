import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAffiliateAdminUrl,
  isAffiliateAssignableEmployee,
  coerceAssignedUserId,
} from '../src/utils/affiliateAdminLink.js';

describe('buildAffiliateAdminUrl', () => {
  it('joins origin + optional base path + token', () => {
    assert.equal(
      buildAffiliateAdminUrl({
        origin: 'https://spectrumoutfitters.com',
        basePath: '/so-app',
        token: 'abc',
      }),
      'https://spectrumoutfitters.com/so-app/affiliates/abc'
    );
    assert.equal(
      buildAffiliateAdminUrl({ origin: 'http://localhost:5173', basePath: '', token: 't1' }),
      'http://localhost:5173/affiliates/t1'
    );
    assert.equal(
      buildAffiliateAdminUrl({ origin: '', basePath: '', token: 't1' }),
      '/affiliates/t1'
    );
  });
});

describe('isAffiliateAssignableEmployee', () => {
  it('requires role employee and is_active not 0', () => {
    assert.equal(isAffiliateAssignableEmployee({ role: 'employee', is_active: 1 }), true);
    assert.equal(isAffiliateAssignableEmployee({ role: 'employee', is_active: true }), true);
    assert.equal(isAffiliateAssignableEmployee({ role: 'employee' }), true);
    assert.equal(isAffiliateAssignableEmployee({ role: 'employee', is_active: 0 }), false);
    assert.equal(isAffiliateAssignableEmployee({ role: 'admin', is_active: 1 }), false);
    assert.equal(isAffiliateAssignableEmployee({ role: 'employee', is_active: false }), true);
    assert.equal(isAffiliateAssignableEmployee(null), false);
  });
});

describe('coerceAssignedUserId', () => {
  it('maps falsy to null and otherwise Number()', () => {
    assert.equal(coerceAssignedUserId(''), null);
    assert.equal(coerceAssignedUserId(null), null);
    assert.equal(coerceAssignedUserId(undefined), null);
    assert.equal(coerceAssignedUserId(0), null);
    assert.equal(coerceAssignedUserId('12'), 12);
    assert.equal(Number.isNaN(coerceAssignedUserId('abc')), true);
  });
});
