import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { verifyRaffleAdminKey } from "@/lib/verifyRaffleAdmin";
import {
  raffleImagePublicUrl,
  safeSlugSegment,
  validateRaffleUploadBytesAndType,
} from "@/lib/raffleUploadImageGate";

export const runtime = "nodejs";

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
  const check = validateRaffleUploadBytesAndType(file.size, file.type);
  if (!check.ok) {
    return NextResponse.json({ ok: false, error: check.error }, { status: 400 });
  }

  const dir = path.join(process.cwd(), "public", "raffle-images", safeSlugSegment(slug));
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.${check.ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buf);
  return NextResponse.json({ ok: true, url: raffleImagePublicUrl(slug, filename) });
}
