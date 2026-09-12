import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { amazonCartLink } from '../src/utils/amazonCartLink.js';

describe('amazonCartLink', () => {
  it('prefers a trimmed explicit URL over ASIN', () => {
    assert.equal(
      amazonCartLink('  https://www.amazon.com/dp/B00URL  ', 'B00ASIN'),
      'https://www.amazon.com/dp/B00URL'
    );
  });

  it('builds the add-to-cart URL from ASIN when URL is empty', () => {
    assert.equal(
      amazonCartLink('   ', ' B08XYZ1234 '),
      'https://www.amazon.com/gp/aws/cart/add.html?ASIN.1=B08XYZ1234&Quantity.1=1'
    );
  });

  it('encodes reserved ASIN characters and returns null without either field', () => {
    assert.equal(
      amazonCartLink('', 'B0&x=1'),
      'https://www.amazon.com/gp/aws/cart/add.html?ASIN.1=B0%26x%3D1&Quantity.1=1'
    );
    assert.equal(amazonCartLink('', ''), null);
    assert.equal(amazonCartLink(null, undefined), null);
  });
});
