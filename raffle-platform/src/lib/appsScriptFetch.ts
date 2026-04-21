/** Google Apps Script web apps can cold-start slowly; stay under nginx proxy_read_timeout. */
const APPS_SCRIPT_TIMEOUT_MS = 90_000;

export function fetchAppsScriptPost(base: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(base, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    signal: AbortSignal.timeout(APPS_SCRIPT_TIMEOUT_MS),
  });
}
