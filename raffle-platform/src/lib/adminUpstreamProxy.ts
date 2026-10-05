/** Decisions for admin Apps Script proxies (insights, stats). */

export type AdminUpstreamPreflight =
  | { ok: false; status: 401; body: { ok: false; error: "missing_admin_key" } }
  | { ok: false; status: 503; body: { ok: false; error: "server_misconfigured" } }
  | { ok: true; adminKey: string; appsScriptUrl: string };

export type AdminUpstreamMapped = {
  status: number;
  body: unknown;
};

/** Missing key wins over a missing Apps Script URL so the client re-prompts for the key. */
export function adminUpstreamPreflight(
  adminKeyHeader: string | null | undefined,
  appsScriptUrl: string | null | undefined,
): AdminUpstreamPreflight {
  const adminKey = typeof adminKeyHeader === "string" ? adminKeyHeader.trim() : "";
  if (!adminKey) {
    return { ok: false, status: 401, body: { ok: false, error: "missing_admin_key" } };
  }
  if (!appsScriptUrl) {
    return { ok: false, status: 503, body: { ok: false, error: "server_misconfigured" } };
  }
  return { ok: true, adminKey, appsScriptUrl };
}

export function adminUpstreamFromThrow(thrown: unknown): AdminUpstreamMapped {
  const name = thrown instanceof Error ? thrown.name : "";
  if (name === "TimeoutError" || name === "AbortError") {
    return { status: 504, body: { ok: false, error: "apps_script_timeout" } };
  }
  return { status: 502, body: { ok: false, error: "upstream_unreachable" } };
}

/** Pass upstream JSON through. A 2xx body is returned as HTTP 200. */
export function adminUpstreamFromBody(
  httpOk: boolean,
  httpStatus: number,
  text: string,
): AdminUpstreamMapped {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { status: 502, body: { ok: false, error: "upstream_not_json" } };
  }
  return { status: httpOk ? 200 : httpStatus, body: data };
}
