import { NextResponse } from "next/server";
import { fetchAppsScriptPost } from "@/lib/appsScriptFetch";
import { getAppsScriptUrl } from "@/lib/env";

type DrawBody = {
  raffleId: string;
  /** Phones to exclude from pool (e.g. previous winner on redraw) */
  excludePhones?: string[];
  testModeOnly?: boolean;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const adminKey = request.headers.get("x-admin-key")?.trim();
  if (!adminKey) {
    return NextResponse.json({ ok: false, error: "missing_admin_key" }, { status: 401 });
  }

  let body: DrawBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!body.raffleId) {
    return NextResponse.json({ ok: false, error: "missing_raffleId" }, { status: 400 });
  }

  const base = getAppsScriptUrl();
  if (!base) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });
  }
  try {
    const res = await fetchAppsScriptPost(base, {
      action: "drawWinner",
      slug,
      adminKey,
      raffleId: body.raffleId,
      excludePhones: body.excludePhones ?? [],
      testModeOnly: Boolean(body.testModeOnly),
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
      return NextResponse.json({ ok: false, error: "apps_script_timeout" }, { status: 504 });
    }
    return NextResponse.json({ ok: false, error: "upstream_unreachable" }, { status: 502 });
  }
}
