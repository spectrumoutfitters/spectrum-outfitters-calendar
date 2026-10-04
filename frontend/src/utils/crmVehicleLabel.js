/**
 * CRM vehicle labels and the add-vehicle form on the customer page.
 * Customer lists prefer plate over VIN when year/make/model are blank.
 * Invoice lists prefer VIN over plate in that same case.
 * Detail pages always prefer VIN, then plate.
 */

export function vehicleFieldTitleCase(value) {
  const s = (value || '').toString().trim();
  if (!s) return '';
  return s
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** VIN and plate inputs upper-case as typed and do not trim. */
export function uppercaseVehicleCode(value) {
  return String(value ?? '').toUpperCase();
}

/** Save stays disabled until year, make, or model is truthy. VIN and plate alone do not count. */
export function canSaveCustomerVehicle(form) {
  return Boolean(form?.year || form?.make || form?.model);
}

/** Falsy fields become null. Whitespace is kept because it is truthy. */
export function customerVehiclePayload(form) {
  const src = form || {};
  return {
    year: src.year || null,
    make: src.make || null,
    model: src.model || null,
    vin: src.vin || null,
    license_plate: src.license_plate || null,
  };
}

export function vehicleRecordTitle(vehicle) {
  if (!vehicle) return 'Vehicle';
  const ymm = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
  return ymm || 'Vehicle';
}

export function vehicleRecordIdentifier(vehicle, emptyLabel) {
  if (vehicle?.vin) return `VIN ${vehicle.vin}`;
  if (vehicle?.license_plate) return `Plate ${vehicle.license_plate}`;
  return emptyLabel;
}

/** Customer table: year/make/model, else plate, else VIN. */
export function customerListVehicleLabel(customer) {
  const ymm = [customer?.primary_vehicle_year, customer?.primary_vehicle_make, customer?.primary_vehicle_model]
    .filter(Boolean)
    .join(' ');
  return ymm || customer?.primary_plate || customer?.primary_vin || '—';
}

/** Invoice table: year/make/model, else VIN, else plate. */
export function invoiceListVehicleLabel(invoice) {
  const ymm = [invoice?.year, invoice?.make, invoice?.model].filter(Boolean).join(' ');
  return ymm || invoice?.vin || invoice?.license_plate || '—';
}
