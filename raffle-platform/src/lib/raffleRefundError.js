/** Operator-facing copy for POST /api/admin/[slug]/refund error codes. */
export function formatRefundError(code) {
  if (!code) return 'Refund failed.';
  if (code === 'password_required') return 'Type your admin password to confirm.';
  if (code === 'password_mismatch') return "Password didn't match the saved admin key.";
  if (code === 'missing_admin_key') return 'Admin key missing — re-enter it at the top of the page.';
  if (code === 'unauthorized') return 'Admin key was rejected.';
  if (code === 'missing_session') return 'Stripe session id was missing on this row.';
  if (code === 'not_paid') return "Stripe says this session is not in 'paid' state.";
  if (code === 'no_payment_intent') return "Stripe couldn't return a payment intent for this session.";
  if (code === 'stripe_not_configured') return 'STRIPE_SECRET_KEY is not set on the server.';
  if (code === 'server_misconfigured') return 'APPS_SCRIPT_URL is not set on the server.';
  if (code.startsWith('stripe_missing_refund_permission')) return code.split(': ')[1] || code;
  if (code.startsWith('refund_done_but_sheet_failed')) {
    return (
      'Stripe refund went through but the sheet did not update — re-run, or zero those tickets manually. Details: ' +
      code
    );
  }
  return code;
}
