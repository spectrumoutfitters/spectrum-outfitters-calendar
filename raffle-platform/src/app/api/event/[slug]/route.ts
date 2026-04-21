import { NextResponse } from "next/server";
import { getAppsScriptUrl } from "@/lib/env";

export const revalidate = 60;

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  if (!slug || slug.length > 80) {
    return NextResponse.json({ ok: false, error: "invalid_slug" }, { status: 400 });
  }

  const base = getAppsScriptUrl();
  if (!base) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });
  }
  const url = `${base}?action=getEvent&slug=${encodeURIComponent(slug)}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      next: { revalidate: 60 },
      headers: { Accept: "application/json" },
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: "upstream_not_json" },
        { status: 502 },
      );
    }
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ ok: false, error: "upstream_unreachable" }, { status: 502 });
  }
}
