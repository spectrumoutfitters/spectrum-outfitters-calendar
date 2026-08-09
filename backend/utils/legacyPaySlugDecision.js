/**
 * Legacy GET /pay/:slug was a short_links 302.
 * CRM invoice checkout also uses /pay/:token (32-hex) for the PayInvoice SPA.
 * When no short_link row matches, fall through so production SPA can serve the page.
 *
 * @param {{ target_url?: string } | null | undefined} shortLinkRow
 * @returns {{ type: 'redirect', targetUrl: string } | { type: 'next' }}
 */
export function decideLegacyPaySlugResponse(shortLinkRow) {
  const target = shortLinkRow?.target_url != null ? String(shortLinkRow.target_url).trim() : '';
  if (target) {
    return { type: 'redirect', targetUrl: target };
  }
  return { type: 'next' };
}
