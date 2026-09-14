import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractWorkItems, extractVehicleInfo } from '../utils/pdfRepairOrderParse.js';

const SAMPLE_RO = [
  'Spectrum Outfitters',
  'Repair Order #4412',
  'Page 1',
  'Description Item Price Qty',
  '1 Motor Oil Part #: 5W30 $9.32 QTY: 7',
  '2 Motorcraft Engine Oil Filter $12.00',
  '1 MOTOR OIL $9.32',
  'Subtotal $21.32',
  'Total $21.32',
].join('\n');

describe('extractWorkItems', () => {
  it('keeps numbered items after a description header and title-cases them', () => {
    const items = extractWorkItems(SAMPLE_RO);
    assert.deepEqual(
      items.map((i) => i.title),
      ['Motor Oil', 'Motorcraft Engine Oil Filter']
    );
  });

  it('strips part numbers, prices, and trailing qty from the title', () => {
    const items = extractWorkItems(SAMPLE_RO);
    assert.equal(items[0].title.includes('5W30'), false);
    assert.equal(items[0].title.includes('$'), false);
    assert.equal(/qty/i.test(items[0].title), false);
  });

  it('dedupes case-insensitively and ignores items before the work section', () => {
    const text = [
      '1 Orphan Line That Should Be Dropped',
      'Item Qty',
      '1 Cabin Filter',
      '2 cabin filter',
    ].join('\n');
    assert.deepEqual(extractWorkItems(text), [{ title: 'Cabin Filter' }]);
  });

  it('stops after page 2 and at inspection / vehicle intake', () => {
    const afterPage2 = [
      'Description',
      '1 Brake Pads',
      'Page 3',
      '1 Should Not Appear',
    ].join('\n');
    assert.deepEqual(extractWorkItems(afterPage2), [{ title: 'Brake Pads' }]);

    const inspection = [
      'Description',
      '1 Cabin Air Filter',
      'Vehicle Intake',
      '1 Should Not Appear',
    ].join('\n');
    assert.deepEqual(extractWorkItems(inspection), [{ title: 'Cabin Air Filter' }]);
  });

  it('drops too-short numbered descriptions', () => {
    const text = ['Description', '1 AB', '2 Real Item Name'].join('\n');
    assert.deepEqual(extractWorkItems(text), [{ title: 'Real Item Name' }]);
  });
});

describe('extractVehicleInfo', () => {
  it('parses VIN, year/make/model, RO number, and mileage commas', () => {
    const text = [
      'Repair Order: 4412',
      'VIN: 1HGCM82633A004352',
      '2020 Ford F150 SuperCrew',
      'Mileage: 12,345 mi',
    ].join('\n');
    const info = extractVehicleInfo(text);
    assert.equal(info.vin, '1HGCM82633A004352');
    assert.equal(info.year, '2020');
    assert.equal(info.make, 'Ford');
    assert.ok(info.model.includes('F150'));
    assert.equal(info.repairOrderNumber, '4412');
    assert.equal(info.mileage, '12345');
  });

  it('returns an empty object when no vehicle fields are present', () => {
    assert.deepEqual(extractVehicleInfo('no vehicle data here'), {});
  });
});
