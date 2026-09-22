const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isMonitorLowStock, formatQuantityChange, parseMonitorDevice } = require('../monitorDisplay');

describe('isMonitorLowStock', () => {
  it('flags quantity at or below a positive minimum', () => {
    assert.equal(isMonitorLowStock({ quantity: 2, min_quantity: 5 }), true);
    assert.equal(isMonitorLowStock({ quantity: 5, min_quantity: 5 }), true);
  });

  it('does not flag quantity above the minimum', () => {
    assert.equal(isMonitorLowStock({ quantity: 6, min_quantity: 5 }), false);
  });

  it('treats a missing quantity as zero when a minimum is set', () => {
    assert.equal(isMonitorLowStock({ min_quantity: 1 }), true);
  });

  it('ignores items with no minimum, a zero minimum, or a non-numeric minimum', () => {
    assert.equal(isMonitorLowStock({ quantity: 0, min_quantity: null }), false);
    assert.equal(isMonitorLowStock({ quantity: 0, min_quantity: 0 }), false);
    assert.equal(isMonitorLowStock({ quantity: 0, min_quantity: 'nope' }), false);
    assert.equal(isMonitorLowStock({ quantity: 0 }), false);
  });
});

describe('formatQuantityChange', () => {
  it('prefixes increases and a zero delta with +', () => {
    assert.equal(formatQuantityChange(3, 5, 'qt'), '+2 qt');
    assert.equal(formatQuantityChange(4, 4, 'ea'), '+0 ea');
  });

  it('shows a signed decrease without an extra plus', () => {
    assert.equal(formatQuantityChange(10, 7, 'gal'), '-3 gal');
  });

  it('returns an em dash when either side is missing', () => {
    assert.equal(formatQuantityChange(null, 2, 'ea'), '—');
    assert.equal(formatQuantityChange(2, undefined, 'ea'), '—');
  });

  it('does not invent a plus sign for a non-numeric quantity', () => {
    assert.equal(formatQuantityChange('abc', 1, 'ea'), 'NaN ea');
  });
});

describe('parseMonitorDevice', () => {
  it('returns desktop placeholders for a missing user agent', () => {
    assert.deepEqual(parseMonitorDevice(null), { type: 'Desktop', browser: '—', os: '—' });
    assert.deepEqual(parseMonitorDevice(12), { type: 'Desktop', browser: '—', os: '—' });
  });

  it('keeps a realistic iPhone UA in the mobile filter; Mac OS X wins the OS label', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    assert.deepEqual(parseMonitorDevice(ua), { type: 'Mobile', browser: 'Safari', os: 'macOS' });
  });

  it('labels iOS only when the UA names iPhone without a Mac OS token', () => {
    assert.deepEqual(parseMonitorDevice('iphone'), { type: 'Mobile', browser: '—', os: 'iOS' });
  });

  it('prefers Edge over Chrome when both tokens are present', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
    assert.deepEqual(parseMonitorDevice(ua), { type: 'Desktop', browser: 'Edge', os: 'Windows' });
  });

  it('keeps Android phones in the mobile filter even when the UA also says Linux', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 13; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
    const parsed = parseMonitorDevice(ua);
    assert.equal(parsed.type, 'Mobile');
    assert.equal(parsed.browser, 'Chrome');
    assert.equal(parsed.os, 'Linux');
  });
});
