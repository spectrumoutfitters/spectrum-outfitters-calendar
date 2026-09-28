import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('extractVehicleInfoFromOrder', () => {
  it('copies vehicle identity, stringifies mileage and the repair-order number', async () => {
    const { extractVehicleInfoFromOrder } = await import('../utils/shopmonkey.js');

    const info = extractVehicleInfoFromOrder({
      number: 1042,
      vehicle: {
        year: 2021,
        make: 'Ford',
        model: 'F-150',
        vin: '1FTFW1E50MFA00001',
        mileage: 1000.5,
      },
      customer: { name: 'Ada Lovelace' },
    });

    assert.deepEqual(info, {
      year: 2021,
      make: 'Ford',
      model: 'F-150',
      vin: '1FTFW1E50MFA00001',
      mileage: '1000.5',
      repairOrderNumber: '1042',
      customerName: 'Ada Lovelace',
    });
  });

  it('omits missing vehicle and customer fields but keeps a repair-order number', async () => {
    const { extractVehicleInfoFromOrder } = await import('../utils/shopmonkey.js');

    const info = extractVehicleInfoFromOrder({
      number: 'RO-9',
      customer: {},
    });

    assert.deepEqual(info, { repairOrderNumber: 'RO-9' });
  });

  it('returns an empty object when the order has no vehicle, number, or customer name', async () => {
    const { extractVehicleInfoFromOrder } = await import('../utils/shopmonkey.js');
    assert.deepEqual(extractVehicleInfoFromOrder({}), {});
    assert.deepEqual(extractVehicleInfoFromOrder({ vehicle: {}, customer: { name: '' } }), {});
  });
});
