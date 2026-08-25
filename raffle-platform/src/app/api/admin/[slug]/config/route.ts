import { NextResponse } from "next/server";
import { fetchAppsScriptPost } from "@/lib/appsScriptFetch";
import { getAppsScriptUrl } from "@/lib/env";
import { coerceEventConfigSave, isMissingAdminKey } from "@/lib/adminEventConfigGate";

async function forwardToScript(body: Record<string, unknown>) {
  const base = getAppsScriptUrl();
  if (!base) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });
  }
  const res = await fetchAppsScriptPost(base, body);
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "upstream_not_json" }, { status: 502 });
  }
  return NextResponse.json(data, { status: res.ok ? 200 : res.status });
}

/** Load editable event + all raffles (Apps Script must include getAdminEventConfig). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const rawKey = _request.headers.get("x-admin-key") ?? "";
  if (isMissingAdminKey(rawKey)) {
    return NextResponse.json({ ok: false, error: "missing_admin_key" }, { status: 401 });
  }
  const adminKey = rawKey.trim();
  try {
    return await forwardToScript({ action: "getAdminEventConfig", slug, adminKey });
  } catch (e: unknown) {
    const name = e instanceof Error ? e.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      return NextResponse.json({ ok: false, error: "apps_script_timeout" }, { status: 504 });
    }
    return NextResponse.json({ ok: false, error: "upstream_unreachable" }, { status: 502 });
  }
}

/** Save event branding + full raffle list to the Google Sheet. */
export async function PUT(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const rawKey = request.headers.get("x-admin-key") ?? "";
  if (isMissingAdminKey(rawKey)) {
    return NextResponse.json({ ok: false, error: "missing_admin_key" }, { status: 401 });
  }
  const adminKey = rawKey.trim();
  let payload: { event?: Record<string, unknown>; raffles?: unknown[] };
  try {
    payload = (await request.json()) as { event?: Record<string, unknown>; raffles?: unknown[] };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const coerced = coerceEventConfigSave(payload);
  try {
    return await forwardToScript({
      action: "saveEventConfig",
      slug,
      adminKey,
      event: coerced.event,
      raffles: coerced.raffles,
    });
  } catch (e: unknown) {
    const name = e instanceof Error ? e.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      return NextResponse.json({ ok: false, error: "apps_script_timeout" }, { status: 504 });
    }
    return NextResponse.json({ ok: false, error: "upstream_unreachable" }, { status: 502 });
  }
}
