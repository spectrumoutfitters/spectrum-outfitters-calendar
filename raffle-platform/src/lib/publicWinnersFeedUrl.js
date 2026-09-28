/**
 * Public winners-feed proxy URL for GET /api/event/[slug]/public-winners.
 * Slug rules match the public event GET: no trim, max 80, falsy rejected.
 * The slug is encoded so `&` / `?` cannot rewrite the Apps Script action.
 */

export const PUBLIC_WINNERS_SLUG_MAX = 80;

/**
 * @param {string | null | undefined} base Apps Script web-app URL
 * @param {unknown} slug
 * @returns {{ error: 'invalid_slug' | 'server_misconfigured' } | { url: string }}
 */
export function resolvePublicWinnersFeedUrl(base, slug) {
  if (!slug || String(slug).length > PUBLIC_WINNERS_SLUG_MAX) {
    return { error: 'invalid_slug' };
  }
  if (!base) {
    return { error: 'server_misconfigured' };
  }
  return {
    url: `${base}?action=getPublicWinnersFeed&slug=${encodeURIComponent(String(slug))}`,
  };
}
