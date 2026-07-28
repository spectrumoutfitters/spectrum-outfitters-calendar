import { fetchAppsScriptPost } from "./appsScriptFetch.ts";
import { getAppsScriptUrl } from "./env.ts";

/** Confirms admin key for slug via Apps Script (same path as stats). */
export async function verifyRaffleAdminKey(slug: string, adminKey: string): Promise<boolean> {
  const base = getAppsScriptUrl();
  if (!base || !adminKey.trim()) return false;
  try {
    const res = await fetchAppsScriptPost(base, { action: "getAdminStats", slug, adminKey });
    const data = (await res.json()) as { ok?: boolean };
    return res.ok && Boolean(data.ok);
  } catch {
    return false;
  }
}
