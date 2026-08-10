/**
 * Classify Apps Script applyPaidTickets JSON (ContentService always HTTP 200).
 *
 * - applied: tickets were written (or alreadyApplied)
 * - draw_locked: destination pool inside T−10m / post-draw freeze — do not retry; refund
 * - retry: transient / other logical failure — Stripe should retry (HTTP 5xx)
 *
 * @param {unknown} data
 * @returns {{ kind: 'applied' | 'draw_locked' | 'retry'; error?: string, code?: string }}
 */
export function classifyPaidApplyUpstream(data) {
  const body = data && typeof data === "object" ? /** @type {{ ok?: boolean, error?: string, code?: string }} */ (data) : null;
  if (body && body.ok === true) {
    return { kind: "applied" };
  }
  const code = body?.code != null ? String(body.code) : "";
  const error = body?.error != null ? String(body.error) : "apps_script_logical_failure";
  if (code === "locked") {
    return { kind: "draw_locked", error, code };
  }
  return { kind: "retry", error, code: code || undefined };
}
