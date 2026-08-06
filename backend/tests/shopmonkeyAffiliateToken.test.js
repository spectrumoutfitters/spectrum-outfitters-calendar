import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractAffiliateToken } from '../utils/shopmonkeyAffiliateToken.js';

describe('extractAffiliateToken', () => {
  it('returns null for empty/non-object payloads', () => {
    assert.equal(extractAffiliateToken(null), null);
    assert.equal(extractAffiliateToken({}), null);
    assert.equal(extractAffiliateToken({ description: 'no token here' }), null);
  });

  it('reads AFFILIATE_TOKEN from description with = or :', () => {
    assert.equal(
      extractAffiliateToken({ description: 'Customer ref AFFILIATE_TOKEN=abc123xyz' }),
      'abc123xyz'
    );
    assert.equal(
      extractAffiliateToken({ description: 'AFFILIATE_TOKEN:token_value_99' }),
      'token_value_99'
    );
  });

  it('accepts case-insensitive affiliate_token / affiliate-token forms', () => {
    assert.equal(
      extractAffiliateToken({ note: 'affiliate_token=Affiliate1' }),
      'Affiliate1'
    );
    assert.equal(
      extractAffiliateToken({ note: 'Affiliate-Token:SecondTok' }),
      'SecondTok'
    );
  });

  it('searches workRequest description, metadata, and customFields', () => {
    assert.equal(
      extractAffiliateToken({
        workRequest: { description: 'AFFILIATE_TOKEN=wrkReqToken1' }
      }),
      'wrkReqToken1'
    );
    assert.equal(
      extractAffiliateToken({
        metadata: { campaign: 'AFFILIATE_TOKEN=metaTok99' }
      }),
      'metaTok99'
    );
    assert.equal(
      extractAffiliateToken({
        customFields: { affiliate: 'affiliate_token=customTok1' }
      }),
      'customTok1'
    );
  });

  it('rejects tokens shorter than 6 characters', () => {
    assert.equal(
      extractAffiliateToken({ description: 'AFFILIATE_TOKEN=short' }),
      null
    );
  });

  it('prefers uppercase AFFILIATE_TOKEN match when both forms appear', () => {
    assert.equal(
      extractAffiliateToken({
        description: 'affiliate_token=lowerTok\nAFFILIATE_TOKEN=UpperTok'
      }),
      'UpperTok'
    );
  });
});
