/**
 * Extract an affiliate attribution token from ShopMonkey webhook / order payloads.
 */

/**
 * @param {object|null|undefined} payload
 * @returns {string|null}
 */
export function extractAffiliateToken(payload) {
  if (!payload || typeof payload !== 'object') return null;

  const candidates = [];
  const pushIfString = (v) => {
    if (typeof v === 'string' && v.trim()) candidates.push(v.trim());
  };

  pushIfString(payload.description);
  pushIfString(payload.note);
  pushIfString(payload.externalId);
  pushIfString(payload.workRequest?.description);
  pushIfString(payload.work_request?.description);

  if (payload.metadata && typeof payload.metadata === 'object') {
    for (const v of Object.values(payload.metadata)) {
      pushIfString(v);
    }
  }

  if (payload.customFields && typeof payload.customFields === 'object') {
    for (const v of Object.values(payload.customFields)) {
      pushIfString(v);
    }
  }

  const combined = candidates.join('\n');
  const m = combined.match(/AFFILIATE_TOKEN[:=]([a-zA-Z0-9_-]{6,64})/);
  if (m?.[1]) return m[1];

  const m2 = combined.match(/affiliate[_-]?token[:=]([a-zA-Z0-9_-]{6,64})/i);
  if (m2?.[1]) return m2[1];

  return null;
}
