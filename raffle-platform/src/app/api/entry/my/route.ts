import { NextResponse } from "next/server";
import { fetchAppsScriptPost } from "@/lib/appsScriptFetch";
import { getAppsScriptUrl } from "@/lib/env";
import { getClientIpFromRequest } from "@/lib/clientIp";
import {
  isHoneypotManagePatch,
  isMissingIdentity,
  normalizeIdentityField,
  recordRateHit,
} from "@/lib/manageEntryApiGate";

const ipHits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const result = recordRateHit(ipHits.get(ip) ?? [], now);
  ipHits.set(ip, result.hits);
  return result.limited;
}

/** Load entry snapshot for “manage my entry” magic link. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = normalizeIdentityField(searchParams.get("slug"));
  const token = normalizeIdentityField(searchParams.get("token"));
  if (isMissingIdentity(slug, token)) {
    return NextResponse.json({ ok: false, error: "missing_slug_or_token", code: "fields" }, { status: 400 });
  }

  const ip = getClientIpFromRequest(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Try again later.", code: "rate_limited" },
      { status: 429 },
    );
  }

  const base = getAppsScriptUrl();
  if (!base) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });
  }

  try {
    const res = await fetchAppsScriptPost(base, {
      action: "getEntryByToken",
      payload: { slug, token, clientIp: ip },
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({ ok: false, error: "upstream_not_json" }, { status: 502 });
    }
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (e: unknown) {
    const name = e instanceof Error ? e.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      return NextResponse.json({ ok: false, error: "apps_script_timeout", code: "timeout" }, { status: 504 });
    }
    return NextResponse.json({ ok: false, error: "upstream_unreachable" }, { status: 502 });
  }
}

/** Update split / bonuses for an existing entry (identity fields must match sheet). */
export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const slug = normalizeIdentityField(body.slug);
  const token = normalizeIdentityField(body.token);
  if (isMissingIdentity(slug, token)) {
    return NextResponse.json({ ok: false, error: "missing_slug_or_token", code: "fields" }, { status: 400 });
  }

  const ip = getClientIpFromRequest(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Try again later.", code: "rate_limited" },
      { status: 429 },
    );
  }

  if (isHoneypotManagePatch(body)) {
    return NextResponse.json({ ok: true, totalEntries: 0, message: "ok" });
  }

  const base = getAppsScriptUrl();
  if (!base) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });
  }

  const forward = {
    action: "updateEntryByToken",
    payload: {
      ...body,
      slug,
      token,
      clientIp: ip,
      userAgent: request.headers.get("user-agent") ?? "",
    },
  };

  try {
    const res = await fetchAppsScriptPost(base, forward);
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({ ok: false, error: "upstream_not_json" }, { status: 502 });
    }
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (e: unknown) {
    const name = e instanceof Error ? e.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      return NextResponse.json({ ok: false, error: "apps_script_timeout", code: "timeout" }, { status: 504 });
    }
    return NextResponse.json({ ok: false, error: "upstream_unreachable" }, { status: 502 });
  }
}
