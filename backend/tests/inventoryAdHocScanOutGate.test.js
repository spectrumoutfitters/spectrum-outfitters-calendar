import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBarcode,
  parseAdHocScanOut,
  itemBarcodeMatches,
} from '../utils/inventoryAdHocScanOutGate.js';

describe('normalizeBarcode', () => {
  it('returns null for undefined, null, empty, and whitespace', () => {
    assert.equal(normalizeBarcode(undefined), null);
    assert.equal(normalizeBarcode(null), null);
    assert.equal(normalizeBarcode(''), null);
    assert.equal(normalizeBarcode('   '), null);
  });

  it('trims and keeps a non-empty code, including numeric 0', () => {
    assert.equal(normalizeBarcode('  ABC-1  '), 'ABC-1');
    assert.equal(normalizeBarcode(0), '0');
  });
});

describe('parseAdHocScanOut', () => {
  const ok = { quantity_used: '2', reason: 'broke on bay 3', barcode: '  SKU-9  ' };

  it('accepts a positive qty, trimmed reason, and trimmed barcode', () => {
    assert.deepEqual(parseAdHocScanOut(ok), {
      ok: true,
      quantityUsed: 2,
      reason: 'broke on bay 3',
      barcode: 'SKU-9',
    });
  });

  it('rejects missing, zero, negative, and non-numeric qty with the scan-out error string', () => {
    for (const quantity_used of [undefined, null, '', '0', 0, -1, 'abc']) {
      const r = parseAdHocScanOut({ ...ok, quantity_used });
      assert.equal(r.ok, false, `qty ${JSON.stringify(quantity_used)} should fail`);
      assert.equal(r.error, 'Quantity to use must be a positive number.');
    }
  });

  it('treats undefined/null reason as missing and rejects whitespace-only', () => {
    for (const reason of [undefined, null, '', '   ']) {
      const r = parseAdHocScanOut({ ...ok, reason });
      assert.equal(r.ok, false);
      assert.equal(r.error, 'Reason is required when scanning out an item not on a task.');
    }
  });

  it('keeps a reason that is only the digit 0 after coerce', () => {
    const r = parseAdHocScanOut({ ...ok, reason: 0 });
    assert.equal(r.ok, true);
    assert.equal(r.reason, '0');
  });

  it('rejects missing/whitespace barcode after normalize', () => {
    for (const barcode of [undefined, null, '', '   ']) {
      const r = parseAdHocScanOut({ ...ok, barcode });
      assert.equal(r.ok, false);
      assert.equal(r.error, 'Scan the item barcode to confirm. Barcode is required.');
    }
  });
});

describe('itemBarcodeMatches', () => {
  it('matches the primary barcode after normalize and ignores unused alternate', () => {
    assert.equal(itemBarcodeMatches('  SKU-9  ', 'SKU-9', false), true);
  });

  it('rejects a different primary when no alternate match is present', () => {
    assert.equal(itemBarcodeMatches('SKU-9', 'OTHER', false), false);
    assert.equal(itemBarcodeMatches('SKU-9', 'OTHER', null), false);
  });

  it('accepts an alternate match even when primary differs', () => {
    assert.equal(itemBarcodeMatches('SKU-9', 'ALT-1', { id: 1 }), true);
    assert.equal(itemBarcodeMatches(null, 'ALT-1', true), true);
  });
});
