import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseReceiveQuantity,
  refillReceiveStatusGate,
  stockAfterReceive,
  parseRequiredPositiveId,
  parseUseOnTaskQuantity,
  stockAfterUse,
  parseBatchReceiveEntry,
  parseBatchReceiveItems,
  parseNewItemRequest,
  parseNewItemRequestStatus,
} from '../utils/inventoryQtyGate.js';

describe('parseReceiveQuantity', () => {
  it('allows 0 and finite positives (including greedy parseFloat prefixes)', () => {
    assert.deepEqual(parseReceiveQuantity(0), { ok: true, quantity: 0 });
    assert.deepEqual(parseReceiveQuantity('0'), { ok: true, quantity: 0 });
    assert.deepEqual(parseReceiveQuantity('1.5'), { ok: true, quantity: 1.5 });
    assert.deepEqual(parseReceiveQuantity('  3 '), { ok: true, quantity: 3 });
    assert.deepEqual(parseReceiveQuantity('12abc'), { ok: true, quantity: 12 });
  });

  it('treats undefined/null/empty string as missing (400), not 0', () => {
    assert.equal(parseReceiveQuantity(undefined).ok, false);
    assert.equal(parseReceiveQuantity(null).ok, false);
    assert.equal(parseReceiveQuantity('').ok, false);
    assert.match(parseReceiveQuantity('').error, /non-negative/);
  });

  it('rejects non-finite and negatives; whitespace-only is NaN', () => {
    assert.equal(parseReceiveQuantity('   ').ok, false);
    assert.equal(parseReceiveQuantity('abc').ok, false);
    assert.equal(parseReceiveQuantity(Number.NaN).ok, false);
    assert.equal(parseReceiveQuantity(Infinity).ok, false);
    assert.equal(parseReceiveQuantity(-1).ok, false);
    assert.equal(parseReceiveQuantity('-0.1').ok, false);
  });
});

describe('refillReceiveStatusGate', () => {
  it('blocks received and cancelled; other statuses (including pending/ordered) pass', () => {
    assert.equal(refillReceiveStatusGate('received').ok, false);
    assert.match(refillReceiveStatusGate('received').error, /already received/);
    assert.equal(refillReceiveStatusGate('cancelled').ok, false);
    assert.match(refillReceiveStatusGate('cancelled').error, /cancelled/);
    assert.equal(refillReceiveStatusGate('pending').ok, true);
    assert.equal(refillReceiveStatusGate('ordered').ok, true);
    assert.equal(refillReceiveStatusGate(undefined).ok, true);
  });
});

describe('stockAfterReceive / stockAfterUse', () => {
  it('receive adds (null on-hand counts as 0); use floors at 0', () => {
    assert.equal(stockAfterReceive(10, 2), 12);
    assert.equal(stockAfterReceive(null, 5), 5);
    assert.equal(stockAfterReceive(undefined, 0), 0);
    assert.equal(stockAfterUse(10, 3), 7);
    assert.equal(stockAfterUse(2, 10), 0);
    assert.equal(stockAfterUse(null, 1), 0);
  });
});

describe('parseRequiredPositiveId', () => {
  it('rejects missing/0/NaN; keeps negatives (truthy finite)', () => {
    assert.equal(parseRequiredPositiveId(undefined, 'item_id').ok, false);
    assert.equal(parseRequiredPositiveId(null, 'item_id').ok, false);
    assert.equal(parseRequiredPositiveId(0, 'item_id').ok, false);
    assert.equal(parseRequiredPositiveId('0', 'item_id').ok, false);
    assert.equal(parseRequiredPositiveId('', 'item_id').ok, false);
    assert.equal(parseRequiredPositiveId('abc', 'task_id').ok, false);
    assert.match(parseRequiredPositiveId(0, 'item_id').error, /item_id is required/);
    assert.deepEqual(parseRequiredPositiveId(7, 'item_id'), { ok: true, id: 7 });
    assert.deepEqual(parseRequiredPositiveId('12', 'task_id'), { ok: true, id: 12 });
    assert.deepEqual(parseRequiredPositiveId(-1, 'item_id'), { ok: true, id: -1 });
  });
});

describe('parseUseOnTaskQuantity', () => {
  it('requires a positive finite number (0 allowed on receive, not here)', () => {
    assert.deepEqual(parseUseOnTaskQuantity(1), { ok: true, quantity: 1 });
    assert.deepEqual(parseUseOnTaskQuantity('2.5'), { ok: true, quantity: 2.5 });
    assert.equal(parseUseOnTaskQuantity(0).ok, false);
    assert.equal(parseUseOnTaskQuantity('0').ok, false);
    assert.equal(parseUseOnTaskQuantity(-1).ok, false);
    assert.equal(parseUseOnTaskQuantity(undefined).ok, false);
    assert.equal(parseUseOnTaskQuantity('').ok, false);
    assert.match(parseUseOnTaskQuantity(0).error, /positive/);
  });
});

describe('parseBatchReceiveItems / parseBatchReceiveEntry', () => {
  it('requires a non-empty array; skips invalid rows instead of 400', () => {
    assert.equal(parseBatchReceiveItems(undefined).ok, false);
    assert.equal(parseBatchReceiveItems({}).ok, false);
    assert.equal(parseBatchReceiveItems([]).ok, false);
    assert.match(parseBatchReceiveItems([]).error, /items array is required/);
    assert.equal(parseBatchReceiveItems([{ item_id: 1, quantity: 2 }]).ok, true);

    assert.equal(parseBatchReceiveEntry({ item_id: 1, quantity: 2 }).itemId, 1);
    assert.equal(parseBatchReceiveEntry({ item_id: 1, quantity: 2 }).qty, 2);
    assert.equal(parseBatchReceiveEntry({ item_id: 0, quantity: 2 }), null);
    assert.equal(parseBatchReceiveEntry({ item_id: 1, quantity: 0 }), null);
    assert.equal(parseBatchReceiveEntry({ item_id: 1, quantity: -1 }), null);
    assert.equal(parseBatchReceiveEntry({ item_id: 1, quantity: 'abc' }), null);
    assert.equal(parseBatchReceiveEntry({ quantity: 2 }), null);
  });
});

describe('parseNewItemRequest / parseNewItemRequestStatus', () => {
  it('requires a trimmed name; blank notes/barcode become null; whitespace name fails', () => {
    assert.equal(parseNewItemRequest({ item_name: '' }).ok, false);
    assert.equal(parseNewItemRequest({ item_name: '   ' }).ok, false);
    assert.equal(parseNewItemRequest({}).ok, false);
    assert.deepEqual(parseNewItemRequest({ item_name: '  Filter  ', notes: '  ', barcode: '' }), {
      ok: true,
      name: 'Filter',
      notes: null,
      barcode: null,
    });
    assert.deepEqual(parseNewItemRequest({ item_name: 'Oil', notes: '  5W  ', barcode: '  abc  ' }), {
      ok: true,
      name: 'Oil',
      notes: '5W',
      barcode: 'abc',
    });
  });

  it('PATCH only accepts addressed/dismissed (pending is rejected)', () => {
    assert.deepEqual(parseNewItemRequestStatus('addressed'), { ok: true, status: 'addressed' });
    assert.deepEqual(parseNewItemRequestStatus('dismissed'), { ok: true, status: 'dismissed' });
    assert.equal(parseNewItemRequestStatus('pending').ok, false);
    assert.equal(parseNewItemRequestStatus('').ok, false);
    assert.equal(parseNewItemRequestStatus(undefined).ok, false);
  });
});
