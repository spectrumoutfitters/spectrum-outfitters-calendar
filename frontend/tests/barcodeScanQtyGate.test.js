import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isBarcodeScannerAllowed,
  parseUseOnTaskQuantity,
  parseUseOnTaskSubmit,
  parseBatchReceiveItems,
} from '../src/utils/barcodeScanQtyGate.js';

describe('isBarcodeScannerAllowed', () => {
  it('allows a secure context or hostname localhost', () => {
    assert.equal(isBarcodeScannerAllowed({ isSecureContext: true, hostname: '192.168.1.10' }), true);
    assert.equal(isBarcodeScannerAllowed({ isSecureContext: false, hostname: 'localhost' }), true);
  });

  it('rejects LAN HTTP and 127.0.0.1 (not treated as localhost)', () => {
    assert.equal(isBarcodeScannerAllowed({ isSecureContext: false, hostname: '192.168.1.10' }), false);
    assert.equal(isBarcodeScannerAllowed({ isSecureContext: false, hostname: '127.0.0.1' }), false);
    assert.equal(isBarcodeScannerAllowed({ isSecureContext: 'true', hostname: '192.168.1.10' }), false);
    assert.equal(isBarcodeScannerAllowed({}), false);
  });
});

describe('parseUseOnTaskQuantity / parseUseOnTaskSubmit', () => {
  it('requires a task id before qty', () => {
    assert.deepEqual(
      parseUseOnTaskSubmit({ taskId: '', qtyRaw: '2' }),
      { error: 'Please select a task' }
    );
    assert.deepEqual(
      parseUseOnTaskSubmit({ taskId: 9, qtyRaw: '2' }),
      { quantity: 2 }
    );
  });

  it('rejects empty, non-numeric, zero, and negative qty via !qty || qty <= 0', () => {
    assert.deepEqual(parseUseOnTaskQuantity(''), { error: 'Enter a valid quantity' });
    assert.deepEqual(parseUseOnTaskQuantity('nope'), { error: 'Enter a valid quantity' });
    assert.deepEqual(parseUseOnTaskQuantity('0'), { error: 'Enter a valid quantity' });
    assert.deepEqual(parseUseOnTaskQuantity('-1'), { error: 'Enter a valid quantity' });
  });

  it('accepts greedy parseFloat quantities', () => {
    assert.deepEqual(parseUseOnTaskQuantity('2.5'), { quantity: 2.5 });
    assert.deepEqual(parseUseOnTaskQuantity('3xyz'), { quantity: 3 });
  });
});

describe('parseBatchReceiveItems', () => {
  it('keeps positive qtys and drops empty / zero / negative / NaN', () => {
    const items = parseBatchReceiveItems([
      { item: { id: 1 }, qty: '2' },
      { item: { id: 2 }, qty: '' },
      { item: { id: 3 }, qty: '0' },
      { item: { id: 4 }, qty: '-3' },
      { item: { id: 5 }, qty: 'nope' },
      { item: { id: 6 }, qty: '1.5' },
    ]);
    assert.deepEqual(items, [
      { item_id: 1, quantity: 2 },
      { item_id: 6, quantity: 1.5 },
    ]);
  });
});
