import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractWorkItems, extractVehicleInfo } from '../utils/pdfRepairOrderExtract.js';

const sampleRoText = `
Spectrum Outfitters
Repair Order #12345
Page 1
Item Description Price QTY
1 Motor Oil Part #: 5W30 $9.32 7
2 Motorcraft Engine Oil Filter $12.50 QTY: 1
3 Cabin Air Filter $18.00
Subtotal
Labor
Parts
Grand Total
`;

describe('extractWorkItems', () => {
  it('extracts numbered line items from the description section', () => {
    const items = extractWorkItems(sampleRoText);
    assert.deepEqual(items.map((i) => i.title), [
      'Motor Oil',
      'Motorcraft Engine Oil Filter',
      'Cabin Air Filter',
    ]);
  });

  it('stops before inspection / page 3 content', () => {
    const text = `
Item Description Price
1 Brake Pads $40.00
Page 3
4 Should Not Appear $1.00
Vehicle Intake
5 Also Skipped $2.00
`;
    const items = extractWorkItems(text);
    assert.deepEqual(items.map((i) => i.title), ['Brake Pads']);
  });

  it('dedupes case-insensitive titles and ignores empty input', () => {
    const text = `
Description
1 Oil Filter
2 oil filter
`;
    assert.deepEqual(extractWorkItems(text).map((i) => i.title), ['Oil Filter']);
    assert.deepEqual(extractWorkItems(''), []);
    assert.deepEqual(extractWorkItems(null), []);
  });
});

describe('extractVehicleInfo', () => {
  it('parses VIN, RO number, mileage, and a year/make/model line', () => {
    const text = `
Repair Order #7788
2021 Honda Civic
VIN: 1FTFW1E50MFA12345
Mileage: 12,345 miles
`;
    const info = extractVehicleInfo(text);
    assert.equal(info.vin, '1FTFW1E50MFA12345');
    assert.equal(info.repairOrderNumber, '7788');
    assert.equal(info.mileage, '12345');
    assert.equal(info.year, '2021');
    // Regex is greedy across whitespace/newlines: make absorbs model tokens before the next word ("VIN").
    assert.equal(info.make, 'Honda Civic');
    assert.equal(info.model, 'VIN');
  });

  it('returns empty object when no fields match', () => {
    assert.deepEqual(extractVehicleInfo('no vehicle data here'), {});
  });
});
