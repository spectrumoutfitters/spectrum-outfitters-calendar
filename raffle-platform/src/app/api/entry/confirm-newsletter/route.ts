import { NextResponse } from "next/server";
import { fetchAppsScriptPost } from "@/lib/appsScriptFetch";
import { getAppsScriptUrl } from "@/lib/env";
import { getClientIpFromRequest } from "@/lib/clientIp";

/**
 * Newsletter double-opt-in confirmation. The entrant clicks a magic-link button in their
 * confirmation email; the click lands on /e/[slug]/confirm which calls this endpoint with
 * { slug, token }. Apps Script verifies the token actually opted in, awards the bonus
 * tickets exactly once, and stamps `__newsletterConfirmed: true` on the entry rows.
 */

const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 24;
const ipHits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_WINDOW_MS;
  const prev = ipHits.get(ip) ?? [];
  const kept = prev.filter((t) => t > windowStart);
  if (kept.length >= RATE_MAX) {
    ipHits.set(ip, kept);
    return true;
  }
  kept.push(now);
  ipHits.set(ip, kept);
  return false;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const slug = String(body.slug || "").trim();
  const token = String(body.token || "").trim();
  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "missing_slug_or_token", code: "fields" },
      { status: 400 },
    );
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
      action: "confirmNewsletterByToken",
      payload: {
        slug,
        token,
        clientIp: ip,
        userAgent: request.headers.get("user-agent") ?? "",
      },
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
      return NextResponse.json(
        { ok: false, error: "apps_script_timeout", code: "timeout" },
        { status: 504 },
      );
    }
    return NextResponse.json({ ok: false, error: "upstream_unreachable" }, { status: 502 });
  }
}
