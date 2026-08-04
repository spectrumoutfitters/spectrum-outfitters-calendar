/**
 * Pure helpers mirroring Apps Script paid-apply completeness checks.
 * A session is "already applied" only when summed paid tickets >= expected.
 */

export function sumPaidTicketsFromRows(rows, slug, sessionId) {
  if (!sessionId) return 0;
  let sum = 0;
  for (const row of rows || []) {
    if (String(row.slug || '').trim() !== String(slug).trim()) continue;
    const ex = row.extras || {};
    if (String(ex.__stripeSessionId || '') !== String(sessionId)) continue;
    const fromExtra = Math.floor(Number(ex.__paidTickets) || 0);
    const fromCol = Math.floor(Number(row.tickets) || 0);
    sum += fromExtra > 0 ? fromExtra : fromCol;
  }
  return sum;
}

export function paidPurchaseFullyApplied(rows, slug, sessionId, expectedTickets) {
  const expected = Math.max(0, Math.floor(Number(expectedTickets) || 0));
  const applied = sumPaidTicketsFromRows(rows, slug, sessionId);
  if (expected > 0) return applied >= expected;
  return applied > 0;
}

export function shouldRewritePartialPaidApply(rows, slug, sessionId, expectedTickets) {
  const expected = Math.max(0, Math.floor(Number(expectedTickets) || 0));
  const applied = sumPaidTicketsFromRows(rows, slug, sessionId);
  return applied > 0 && applied < expected;
}
