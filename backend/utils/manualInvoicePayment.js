/**
 * Decide whether a manual invoice payment may be recorded and what the
 * resulting payment_status should be. Pure helper — no DB I/O.
 *
 * Mirrors the amount-due gate used by createStripePaymentIntentForInvoice so
 * cash/check/ACH recording cannot overstate the ledger or mark an invoice paid
 * beyond its remaining balance.
 *
 * @param {{ invoiceTotalCents: number|null|undefined, alreadyPaidCents?: number|null, amountCents: number }} args
 * @returns {{
 *   ok: true,
 *   amountCents: number,
 *   amountDueCents: number,
 *   paymentStatus: 'paid'|'partial'|'unpaid',
 *   newPaidCents: number,
 *   totalCents: number,
 * } | {
 *   ok: false,
 *   error: string,
 *   code: 'invalid_amount'|'not_found'|'already_paid'|'exceeds_due',
 *   amountDueCents?: number,
 * }}
 */
export function decideManualPaymentRecord({ invoiceTotalCents, alreadyPaidCents, amountCents }) {
  const amount = Number(amountCents);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'amount_cents must be > 0', code: 'invalid_amount' };
  }

  if (invoiceTotalCents == null || !Number.isFinite(Number(invoiceTotalCents))) {
    return { ok: false, error: 'Invoice not found', code: 'not_found' };
  }

  const totalCents = Math.max(0, Math.round(Number(invoiceTotalCents)));
  const paidCents = Math.max(0, Math.round(Number(alreadyPaidCents) || 0));
  const amountDueCents = Math.max(0, totalCents - paidCents);

  if (amountDueCents <= 0) {
    return { ok: false, error: 'Invoice is already paid', code: 'already_paid', amountDueCents: 0 };
  }

  const roundedAmount = Math.round(amount);
  if (roundedAmount > amountDueCents) {
    return {
      ok: false,
      error: `Amount exceeds balance due (${amountDueCents} cents)`,
      code: 'exceeds_due',
      amountDueCents,
    };
  }

  const newPaidCents = paidCents + roundedAmount;
  const paymentStatus =
    newPaidCents >= totalCents && totalCents > 0 ? 'paid' : newPaidCents > 0 ? 'partial' : 'unpaid';

  return {
    ok: true,
    amountCents: roundedAmount,
    amountDueCents,
    paymentStatus,
    newPaidCents,
    totalCents,
  };
}
