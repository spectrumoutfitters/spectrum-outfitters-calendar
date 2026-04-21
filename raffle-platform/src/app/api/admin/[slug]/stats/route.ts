import { NextResponse } from "next/server";
import { getAppsScriptUrl } from "@/lib/env";

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const adminKey = request.headers.get("x-admin-key")?.trim();
  if (!adminKey) {
    return NextResponse.json({ ok: false, error: "missing_admin_key" }, { status: 401 });
  }

  const base = getAppsScriptUrl();
  if (!base) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });
  }
  try {
    const res = await fetch(base, {
      method: "POST",
      body: JSON.stringify({ action: "getAdminStats", slug, adminKey }),
      headers: { "Content-Type": "text/plain;charset=utf-8" },
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({ ok: false, error: "upstream_not_json" }, { status: 502 });
    }
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch {
    return NextResponse.json({ ok: false, error: "upstream_unreachable" }, { status: 502 });
  }
}
