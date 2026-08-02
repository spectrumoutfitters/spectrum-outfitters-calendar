import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isSafeHttpsImageUrl } from '../src/lib/safeHttpsImageUrl.js';

describe('isSafeHttpsImageUrl', () => {
  it('allows empty optional URLs and https absolute URLs', () => {
    assert.equal(isSafeHttpsImageUrl(''), true);
    assert.equal(isSafeHttpsImageUrl(null), true);
    assert.equal(isSafeHttpsImageUrl('https://cdn.example.com/prize.jpg'), true);
    assert.equal(isSafeHttpsImageUrl('HTTPS://CDN.EXAMPLE.COM/x.png'), true);
  });

  it('allows same-origin /raffle-images/ uploads only', () => {
    assert.equal(isSafeHttpsImageUrl('/raffle-images/summer/prize.jpg'), true);
    assert.equal(isSafeHttpsImageUrl('/other/images/x.jpg'), false);
    assert.equal(isSafeHttpsImageUrl('//evil.example/raffle-images/x.jpg'), false);
  });

  it('rejects http, data, javascript, and oversized URLs', () => {
    assert.equal(isSafeHttpsImageUrl('http://cdn.example.com/x.jpg'), false);
    assert.equal(isSafeHttpsImageUrl('data:image/png;base64,AAAA'), false);
    assert.equal(isSafeHttpsImageUrl('javascript:alert(1)'), false);
    assert.equal(isSafeHttpsImageUrl(`https://x.test/${'a'.repeat(2100)}`), false);
  });
});
