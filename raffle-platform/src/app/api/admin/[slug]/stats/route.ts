import { NextResponse } from "next/server";
import { fetchAppsScriptPost } from "@/lib/appsScriptFetch";
import {
  adminUpstreamFromBody,
  adminUpstreamFromThrow,
  adminUpstreamPreflight,
} from "@/lib/adminUpstreamProxy";
import { getAppsScriptUrl } from "@/lib/env";

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const preflight = adminUpstreamPreflight(request.headers.get("x-admin-key"), getAppsScriptUrl());
  if (!preflight.ok) {
    return NextResponse.json(preflight.body, { status: preflight.status });
  }

  try {
    const res = await fetchAppsScriptPost(preflight.appsScriptUrl, {
      action: "getAdminStats",
      slug,
      adminKey: preflight.adminKey,
    });
    const text = await res.text();
    const mapped = adminUpstreamFromBody(res.ok, res.status, text);
    return NextResponse.json(mapped.body, { status: mapped.status });
  } catch (e: unknown) {
    const mapped = adminUpstreamFromThrow(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
