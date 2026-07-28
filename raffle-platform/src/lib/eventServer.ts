import { getAppsScriptUrl } from "./env.ts";
import type { EventConfig } from "@/lib/types";

export type GetEventResponse =
  | { ok: true; event: EventConfig }
  | { ok: false; error: string };

export async function fetchEventConfig(
  slug: string,
  /** Use on live/admin paths so a stale getEvent snapshot cannot mask a fixed server */
  options?: { noStore?: boolean },
): Promise<GetEventResponse> {
  const base = getAppsScriptUrl();
  if (!base) {
    return { ok: false, error: "missing_apps_script_url" };
  }
  const url = `${base}?action=getEvent&slug=${encodeURIComponent(slug)}`;
  const res = await fetch(url, {
    method: "GET",
    ...(options?.noStore
      ? { cache: "no-store" as RequestCache }
      : { next: { revalidate: 60 } }),
    headers: { Accept: "application/json" },
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as GetEventResponse;
  } catch {
    return { ok: false, error: "invalid_response" };
  }
}
