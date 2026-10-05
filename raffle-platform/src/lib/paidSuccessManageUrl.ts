/** Where the paid-ticket confirmation page sends the buyer. */

type PaidSuccessConfig =
  | { ok: true; event: { name: string } }
  | { ok: false };

export function paidSuccessEventLabel(res: PaidSuccessConfig): string {
  return res.ok ? res.event.name : "your raffle";
}

/**
 * Magic-link token is optional. Slug and token are encoded so `&`, `=`, and `/`
 * cannot break the path or query.
 */
export function paidSuccessManagePath(slug: string, token: string | undefined): string {
  const path = `/e/${encodeURIComponent(slug)}`;
  if (token) {
    return `${path}/my-entry?token=${encodeURIComponent(token)}`;
  }
  return path;
}
