/**
 * Order status validation and paid_at / fulfilled_at stamp rules.
 * PUT /:id/status always restamps when entering paid/fulfilled.
 * PUT /:id only stamps on a transition (existing status is not already that value).
 */

export const VALID_ORDER_STATUSES = ['pending', 'paid', 'fulfilled', 'cancelled'];

export function isValidOrderStatus(status) {
  return VALID_ORDER_STATUSES.includes(status);
}

/** PUT /api/orders/:id/status */
export function statusRouteTimestampFlags(status) {
  return {
    paidAt: status === 'paid',
    fulfilledAt: status === 'fulfilled',
  };
}

/** PUT /api/orders/:id */
export function updateRouteTimestampFlags(status, existingStatus) {
  return {
    paidAt: status === 'paid' && existingStatus !== 'paid',
    fulfilledAt: status === 'fulfilled' && existingStatus !== 'fulfilled',
  };
}
