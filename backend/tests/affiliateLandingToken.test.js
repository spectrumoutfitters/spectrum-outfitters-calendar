import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isValidAffiliateLandingToken } from '../utils/affiliateLandingToken.js';

describe('isValidAffiliateLandingToken', () => {
  it('accepts 8+ hex characters of either case', () => {
    assert.equal(isValidAffiliateLandingToken('deadbeef'), true);
    assert.equal(isValidAffiliateLandingToken('DEADBEEF'), true);
    assert.equal(isValidAffiliateLandingToken('  ab12cd34ef  '), true);
    assert.equal(isValidAffiliateLandingToken('0123456789abcdef'), true);
  });

  it('rejects short, empty, or non-hex tokens', () => {
    assert.equal(isValidAffiliateLandingToken('deadbee'), false);
    assert.equal(isValidAffiliateLandingToken(''), false);
    assert.equal(isValidAffiliateLandingToken('   '), false);
    assert.equal(isValidAffiliateLandingToken(null), false);
    assert.equal(isValidAffiliateLandingToken('ghijklmn'), false);
    assert.equal(isValidAffiliateLandingToken('token-01'), false);
  });
});
