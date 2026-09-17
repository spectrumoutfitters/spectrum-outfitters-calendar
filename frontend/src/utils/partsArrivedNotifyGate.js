/** Client gate for POST /notifications/quick type=parts_arrived. */

export function partsArrivedError(vehicle, distributor) {
  if (!String(vehicle || '').trim()) {
    return 'Please enter the vehicle/car information';
  }
  if (!String(distributor || '').trim()) {
    return 'Please enter the parts distributor';
  }
  return null;
}

/** `taskTitle` aliases `vehicle` so older admin-board consumers still render a title. */
export function buildPartsArrivedPayload(vehicle, distributor) {
  const trimmedVehicle = String(vehicle || '').trim();
  const trimmedDistributor = String(distributor || '').trim();
  return {
    type: 'parts_arrived',
    taskTitle: trimmedVehicle,
    vehicle: trimmedVehicle,
    distributor: trimmedDistributor,
  };
}
