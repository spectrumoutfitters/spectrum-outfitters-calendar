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
      body: JSON.stringify({ action: "exportEntries", slug, adminKey }),
      headers: { "Content-Type": "text/plain;charset=utf-8" },
    });
    const text = await res.text();
    let data: { ok?: boolean; csv?: string; error?: string };
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      return NextResponse.json({ ok: false, error: "upstream_not_json" }, { status: 502 });
    }
    if (!res.ok || !data.ok || !data.csv) {
      return NextResponse.json(data, { status: res.ok ? 400 : res.status });
    }

    const filename = `entries-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse("\uFEFF" + data.csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "upstream_unreachable" }, { status: 502 });
  }
}
