import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTurn14SearchParams,
  turn14PartLookupKey,
  formatTurn14Price,
  getTurn14PartNumber,
  getTurn14PartName,
} from '../src/utils/turn14PartDisplay.js';

describe('buildTurn14SearchParams', () => {
  it('rejects whitespace-only query / part number and empty vehicle', () => {
    assert.equal(buildTurn14SearchParams({
      searchMode: 'query', searchQuery: '   ', partNumber: '', make: '', model: '', year: '',
    }), null);
    assert.equal(buildTurn14SearchParams({
      searchMode: 'partNumber', searchQuery: '', partNumber: '  ', make: '', model: '', year: '',
    }), null);
    assert.equal(buildTurn14SearchParams({
      searchMode: 'vehicle', searchQuery: '', partNumber: '', make: '  ', model: '', year: '',
    }), null);
  });

  it('trims query / part number and caps results at 50', () => {
    assert.deepEqual(buildTurn14SearchParams({
      searchMode: 'query', searchQuery: '  oil filter  ', partNumber: '', make: '', model: '', year: '',
    }), { query: 'oil filter', limit: 50 });
    assert.deepEqual(buildTurn14SearchParams({
      searchMode: 'partNumber', searchQuery: '', partNumber: '  SKU-1  ', make: '', model: '', year: '',
    }), { partNumber: 'SKU-1', limit: 50 });
  });

  it('includes only provided vehicle fields', () => {
    assert.deepEqual(buildTurn14SearchParams({
      searchMode: 'vehicle', searchQuery: '', partNumber: '', make: 'Ford', model: '  ', year: '2018',
    }), { make: 'Ford', year: '2018', limit: 50 });
  });
});

describe('turn14 part identity and price', () => {
  it('lookup key does not fall back to id (display number does)', () => {
    const onlyId = { id: 'row-9' };
    assert.equal(turn14PartLookupKey(onlyId), undefined);
    assert.equal(getTurn14PartNumber(onlyId), 'row-9');
    assert.equal(getTurn14PartNumber({ sku: 'SKU-2', id: 'row-9' }), 'SKU-2');
  });

  it('prefers partNumber then snake / sku / number for lookup', () => {
    assert.equal(turn14PartLookupKey({ partNumber: 'PN', part_number: 'snake', sku: 's', number: 'n' }), 'PN');
    assert.equal(turn14PartLookupKey({ part_number: 'snake', sku: 's' }), 'snake');
  });

  it('formats number / amount / value prices; leaves strings raw; else N/A', () => {
    assert.equal(formatTurn14Price(12.5), '$12.50');
    assert.equal(formatTurn14Price('already $9'), 'already $9');
    assert.equal(formatTurn14Price({ amount: '4.2' }), '$4.20');
    assert.equal(formatTurn14Price({ value: 3 }), '$3.00');
    assert.equal(formatTurn14Price({}), 'N/A');
    assert.equal(formatTurn14Price(null), 'N/A');
  });

  it('resolves name with description / title / productName fallbacks', () => {
    assert.equal(getTurn14PartName({ name: 'Oil' }), 'Oil');
    assert.equal(getTurn14PartName({ description: 'Filter' }), 'Filter');
    assert.equal(getTurn14PartName({ productName: 'Cap' }), 'Cap');
    assert.equal(getTurn14PartName({}), 'Unknown Part');
  });
});
