import { NextResponse } from "next/server";
import { fetchAppsScriptPost } from "@/lib/appsScriptFetch";
import { getAppsScriptUrl } from "@/lib/env";
import { getClientIpFromRequest } from "@/lib/clientIp";
import type { EntryPayload } from "@/lib/types";

const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 12;
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
  let body: Partial<EntryPayload>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const ip = getClientIpFromRequest(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many submissions. Try again later.", code: "rate_limited" },
      { status: 429 },
    );
  }

  if (body.company) {
    return NextResponse.json({ ok: true, totalEntries: 0, message: "ok" });
  }

  if (!body.termsAccepted) {
    return NextResponse.json(
      { ok: false, error: "You must accept the terms to enter.", code: "terms" },
      { status: 400 },
    );
  }

  const base = getAppsScriptUrl();
  if (!base) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });
  }
  const forward = {
    action: "submitEntry",
    payload: {
      ...body,
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
