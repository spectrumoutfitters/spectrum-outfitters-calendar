import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { verifyRaffleAdminKey } from "@/lib/verifyRaffleAdmin";

export const runtime = "nodejs";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 2 * 1024 * 1024;

function safeSlugSegment(slug: string): string {
  const s = slug.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return s || "event";
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const adminKey = request.headers.get("x-admin-key")?.trim() ?? "";
  if (!(await verifyRaffleAdminKey(slug, adminKey))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "file_too_large" }, { status: 400 });
  }
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime)) {
    return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400 });
  }

  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const dir = path.join(process.cwd(), "public", "raffle-images", safeSlugSegment(slug));
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buf);
  const url = `/raffle-images/${safeSlugSegment(slug)}/${filename}`;
  return NextResponse.json({ ok: true, url });
}
