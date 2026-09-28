import { NextResponse } from "next/server";
import { getAppsScriptUrl } from "@/lib/env";
import { resolvePublicWinnersFeedUrl } from "@/lib/publicWinnersFeedUrl";

export const dynamic = "force-dynamic";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const resolved = resolvePublicWinnersFeedUrl(getAppsScriptUrl(), slug);
  if ("error" in resolved) {
    const status = resolved.error === "invalid_slug" ? 400 : 503;
    return NextResponse.json({ ok: false, error: resolved.error }, { status, headers: CORS_HEADERS });
  }

  const url = resolved.url;

  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: "upstream_not_json" },
        { status: 502, headers: CORS_HEADERS },
      );
    }
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status, headers: CORS_HEADERS });
    }
    return NextResponse.json(data, { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json({ ok: false, error: "upstream_unreachable" }, { status: 502, headers: CORS_HEADERS });
  }
}
