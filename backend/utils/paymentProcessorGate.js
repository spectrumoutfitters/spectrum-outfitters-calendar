/**
 * Which payment processor writes processor_daily_revenue (and thus P&L fallback income).
 * Valor Pay takes precedence whenever it is configured; otherwise the label/sync is Stripe
 * even if STRIPE_SECRET_KEY is missing.
 */

import { PROCESSOR_NAME as VALOR_PROCESSOR, isConfigured as isValorConfigured } from './valorPayRevenue.js';
import { PROCESSOR_NAME as STRIPE_PROCESSOR } from './stripeRevenue.js';

export function getActiveProcessor() {
  return isValorConfigured() ? VALOR_PROCESSOR : STRIPE_PROCESSOR;
}

export { isValorConfigured, VALOR_PROCESSOR, STRIPE_PROCESSOR };
