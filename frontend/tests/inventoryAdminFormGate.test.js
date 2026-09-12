import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseInventoryNumber,
  prepareInventoryAdminPayload,
  parseInventoryQuantityUpdate,
} from '../src/utils/inventoryAdminFormGate.js';

function baseForm(overrides = {}) {
  return {
    barcode: 'ABC-123',
    name: 'Brake fluid',
    category_id: '4',
    unit: 'qt',
    price: '12.50',
    image_url: '',
    needs_return: false,
    return_supplier: '',
    size_per_unit: '32 oz',
    min_quantity: '2',
    keep_in_stock: true,
    location: 'A1',
    location_notes: '',
    preferred_vendor: '',
    supplier_name: '',
    supplier_contact: '',
    supplier_part_number: '',
    reorder_cost: '9.99',
    amazon_asin: 'B00TEST',
    amazon_url: '',
    quantity: '',
    ...overrides,
  };
}

describe('parseInventoryNumber', () => {
  it('parses finite numbers and greedy parseFloat', () => {
    assert.equal(parseInventoryNumber('12.5'), 12.5);
    assert.equal(parseInventoryNumber('10xyz'), 10);
    assert.equal(parseInventoryNumber(0), 0);
  });

  it('maps non-numeric input to null', () => {
    assert.equal(parseInventoryNumber(''), null);
    assert.equal(parseInventoryNumber('abc'), null);
    assert.equal(parseInventoryNumber(undefined), null);
  });
});

describe('prepareInventoryAdminPayload', () => {
  it('requires a barcode on create but not on edit', () => {
    const create = prepareInventoryAdminPayload(baseForm({ barcode: '   ' }), { isCreate: true });
    assert.equal(create.error, 'Barcode is required when adding an item. Scan or enter a barcode.');

    const edit = prepareInventoryAdminPayload(baseForm({ barcode: '   ' }), { isCreate: false });
    assert.equal(edit.error, undefined);
    assert.equal(edit.payload.barcode, null);
  });

  it('requires a name and a return supplier when flagged', () => {
    assert.equal(prepareInventoryAdminPayload(baseForm({ name: '  ' })).error, 'Name is required.');
    assert.equal(
      prepareInventoryAdminPayload(baseForm({ needs_return: true, return_supplier: '  ' })).error,
      'Supplier is required when flagging for return (where was this part bought from?).'
    );
  });

  it('rejects non-numeric price and reorder cost; empty stays null', () => {
    assert.equal(prepareInventoryAdminPayload(baseForm({ price: 'nope' })).error, 'Price must be a number.');
    assert.equal(prepareInventoryAdminPayload(baseForm({ reorder_cost: 'nope' })).error, 'Reorder cost must be a number.');

    const empty = prepareInventoryAdminPayload(baseForm({ price: '', reorder_cost: '' }));
    assert.equal(empty.payload.price, null);
    assert.equal(empty.payload.reorder_cost, null);
  });

  it('coerces payload fields: default unit, empty min_quantity, category Number', () => {
    const { payload, error } = prepareInventoryAdminPayload(baseForm({
      unit: '  ',
      min_quantity: '  ',
      image_url: '  https://img  ',
      category_id: '',
    }));
    assert.equal(error, undefined);
    assert.equal(payload.unit, 'each');
    assert.equal(payload.min_quantity, null);
    assert.equal(payload.image_url, 'https://img');
    assert.equal(payload.category_id, null);
    assert.equal(payload.price, 12.5);
    assert.equal(payload.keep_in_stock, true);
  });
});

describe('parseInventoryQuantityUpdate', () => {
  it('skips empty and rejects negative / non-numeric', () => {
    assert.deepEqual(parseInventoryQuantityUpdate(''), { skip: true });
    assert.equal(parseInventoryQuantityUpdate('abc').error, 'Quantity must be a non-negative number.');
    assert.equal(parseInventoryQuantityUpdate('-1').error, 'Quantity must be a non-negative number.');
    assert.deepEqual(parseInventoryQuantityUpdate('0'), { quantity: 0 });
    assert.deepEqual(parseInventoryQuantityUpdate('3.5'), { quantity: 3.5 });
  });
});
