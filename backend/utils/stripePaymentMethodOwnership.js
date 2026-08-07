/**
 * Stripe PaymentMethod.customer may be a customer id string or an expanded object.
 * Detach/default must refuse PMs that are not attached to the target Stripe customer.
 */
export function paymentMethodBelongsToCustomer(paymentMethod, providerCustomerId) {
  if (!paymentMethod || !providerCustomerId) return false;
  const cust = paymentMethod.customer;
  if (cust == null || cust === '') return false;
  const id = typeof cust === 'string' ? cust : cust.id;
  return typeof id === 'string' && id.length > 0 && id === providerCustomerId;
}
