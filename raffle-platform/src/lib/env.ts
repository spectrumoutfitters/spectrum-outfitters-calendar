export function getAppsScriptUrl(): string | null {
  const url = process.env.APPS_SCRIPT_URL?.trim();
  return url && url.length > 0 ? url : null;
}

/** Site origin used for Stripe success/cancel return URLs. */
export function getRaffleSiteOrigin(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_RAFFLE_SITE_URL?.trim() ||
    process.env.RAFFLE_SITE_URL?.trim() ||
    "";
  return fromEnv.replace(/\/$/, "");
}
