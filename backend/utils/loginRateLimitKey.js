/**
 * Bucket key for POST /api/auth/login.
 * One person (case-insensitive username) on one IP shares a bucket, so a shop
 * NAT is not locked out by a coworker and casing does not double the attempt budget.
 * A missing username falls back to the IP so empty-body floods still share one bucket.
 *
 * @param {{ ip?: string, body?: { username?: string } }} req
 * @returns {string | undefined}
 */
export function loginRateLimitKey(req) {
  return req.body?.username ? `${req.ip}-${req.body.username.toLowerCase()}` : req.ip;
}
