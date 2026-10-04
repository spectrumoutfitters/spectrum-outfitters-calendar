import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canSaveCustomerVehicle,
  customerListVehicleLabel,
  customerVehiclePayload,
  invoiceListVehicleLabel,
  uppercaseVehicleCode,
  vehicleFieldTitleCase,
  vehicleRecordIdentifier,
  vehicleRecordTitle,
} from '../src/utils/crmVehicleLabel.js';

describe('vehicleFieldTitleCase', () => {
  it('trims, collapses spaces, and capitalizes each word', () => {
    assert.equal(vehicleFieldTitleCase('  FORD   f-150 '), 'Ford F-150');
    assert.equal(vehicleFieldTitleCase('mercedes-benz'), 'Mercedes-benz');
  });

  it('returns an empty string for blank values', () => {
    assert.equal(vehicleFieldTitleCase(''), '');
    assert.equal(vehicleFieldTitleCase('   '), '');
    assert.equal(vehicleFieldTitleCase(null), '');
    assert.equal(vehicleFieldTitleCase(undefined), '');
  });
});

describe('uppercaseVehicleCode', () => {
  it('uppercases without trimming', () => {
    assert.equal(uppercaseVehicleCode(' ab12 '), ' AB12 ');
    assert.equal(uppercaseVehicleCode(''), '');
    assert.equal(uppercaseVehicleCode(null), '');
  });
});

describe('canSaveCustomerVehicle', () => {
  it('requires a truthy year, make, or model', () => {
    assert.equal(canSaveCustomerVehicle(null), false);
    assert.equal(canSaveCustomerVehicle({}), false);
    assert.equal(canSaveCustomerVehicle({ year: '', make: '', model: '', vin: '1HGCM82633A004352' }), false);
    assert.equal(canSaveCustomerVehicle({ license_plate: 'ABC123' }), false);
    assert.equal(canSaveCustomerVehicle({ make: 'Toyota' }), true);
    assert.equal(canSaveCustomerVehicle({ year: '2020' }), true);
  });

  it('treats whitespace as enough to enable save', () => {
    assert.equal(canSaveCustomerVehicle({ year: ' ', make: '', model: '' }), true);
  });

  it('does not treat numeric zero as a year', () => {
    assert.equal(canSaveCustomerVehicle({ year: 0, make: '', model: '' }), false);
  });
});

describe('customerVehiclePayload', () => {
  it('sends falsy fields as null and keeps whitespace', () => {
    assert.deepEqual(
      customerVehiclePayload({
        year: '2020',
        make: ' ',
        model: '',
        vin: 0,
        license_plate: 'abc',
      }),
      {
        year: '2020',
        make: ' ',
        model: null,
        vin: null,
        license_plate: 'abc',
      },
    );
  });

  it('returns all nulls for a missing form', () => {
    assert.deepEqual(customerVehiclePayload(null), {
      year: null,
      make: null,
      model: null,
      vin: null,
      license_plate: null,
    });
  });
});

describe('vehicleRecordTitle', () => {
  it('joins year, make, and model and drops falsy parts', () => {
    assert.equal(vehicleRecordTitle({ year: 2020, make: 'Ford', model: '' }), '2020 Ford');
    assert.equal(vehicleRecordTitle({ year: 0, make: '', model: null }), 'Vehicle');
    assert.equal(vehicleRecordTitle(null), 'Vehicle');
  });
});

describe('vehicleRecordIdentifier', () => {
  it('prefers VIN over plate and uses the caller empty label', () => {
    assert.equal(
      vehicleRecordIdentifier({ vin: '1HGCM82633A004352', license_plate: 'ABC123' }, '—'),
      'VIN 1HGCM82633A004352',
    );
    assert.equal(vehicleRecordIdentifier({ vin: '', license_plate: 'ABC123' }, '—'), 'Plate ABC123');
    assert.equal(vehicleRecordIdentifier({}, '—'), '—');
    assert.equal(vehicleRecordIdentifier(null, ''), '');
  });
});

describe('customerListVehicleLabel', () => {
  it('prefers plate over VIN when year, make, and model are blank', () => {
    assert.equal(
      customerListVehicleLabel({
        primary_vehicle_year: '',
        primary_vehicle_make: null,
        primary_vehicle_model: undefined,
        primary_plate: 'ABC123',
        primary_vin: '1HGCM82633A004352',
      }),
      'ABC123',
    );
  });

  it('uses the year/make/model line before either identifier', () => {
    assert.equal(
      customerListVehicleLabel({
        primary_vehicle_year: 2018,
        primary_vehicle_make: 'Toyota',
        primary_vehicle_model: 'Camry',
        primary_plate: 'ABC123',
        primary_vin: '1HGCM82633A004352',
      }),
      '2018 Toyota Camry',
    );
  });

  it('falls through an empty plate to VIN, then an em dash', () => {
    assert.equal(
      customerListVehicleLabel({ primary_plate: '', primary_vin: '1HGCM82633A004352' }),
      '1HGCM82633A004352',
    );
    assert.equal(customerListVehicleLabel({}), '—');
    assert.equal(customerListVehicleLabel(null), '—');
  });
});

describe('invoiceListVehicleLabel', () => {
  it('prefers VIN over plate when year, make, and model are blank', () => {
    assert.equal(
      invoiceListVehicleLabel({
        year: '',
        make: null,
        model: 0,
        vin: '1HGCM82633A004352',
        license_plate: 'ABC123',
      }),
      '1HGCM82633A004352',
    );
  });

  it('uses the year/make/model line before either identifier', () => {
    assert.equal(
      invoiceListVehicleLabel({
        year: 2019,
        make: 'Honda',
        model: 'Civic',
        vin: '1HGCM82633A004352',
        license_plate: 'ABC123',
      }),
      '2019 Honda Civic',
    );
  });

  it('falls through an empty VIN to the plate, then an em dash', () => {
    assert.equal(invoiceListVehicleLabel({ vin: '', license_plate: 'ABC123' }), 'ABC123');
    assert.equal(invoiceListVehicleLabel({}), '—');
    assert.equal(invoiceListVehicleLabel(null), '—');
  });
});
