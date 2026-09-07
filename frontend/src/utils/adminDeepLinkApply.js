/**
 * Jump-palette / URL deep link: /admin?adm=finance&adsub=paystub_maker
 *
 * Distinct from jump-palette match/score (#29/#38) and legacy `tab=`
 * resolve helpers (#16/#20/#26). This only decides whether a query pair
 * may change the admin shell:
 * - Non-admin or missing adm → no-op (query stays).
 * - Unknown main tab → no-op (query stays).
 * - Known main → apply main; apply adsub only when it exists on that main;
 *   always clear adm/adsub after a successful main apply.
 */

export function resolveAdminDeepLink({ adm, adsub, isAdmin, mainTabs, subTabs }) {
  if (!isAdmin || !adm) {
    return { applied: false, clearQuery: false };
  }
  const validMain = (mainTabs || []).some((t) => t.id === adm);
  if (!validMain) {
    return { applied: false, clearQuery: false };
  }
  const subs = (subTabs || {})[adm];
  const validSub = !!(subs && adsub && subs.some((s) => s.id === adsub));
  return {
    applied: true,
    clearQuery: true,
    mainTab: adm,
    subTab: validSub ? adsub : undefined,
  };
}
